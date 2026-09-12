"""
Adds the ONNX metadata sherpa-onnx needs to a stock Piper model.

    python scripts/patchPiperMeta.py <model.onnx> <config.json> <out.onnx>

Piper publishes a model and a JSON config beside it. sherpa-onnx does not read
that config -- it reads seven key/value pairs embedded in the ONNX file itself,
and refuses a model without them:

    'sample_rate' does not exist in the metadata

Every voice in this catalog so far came from csukuangfj's HuggingFace
repositories, which are usually described as mirrors of Piper's models. They are
not. They are the same weights with this metadata added, and that difference is
invisible until you try to load a model that has not been through it -- the file
is the same size, the tokens are identical, and it simply will not open.

This was found the direct way. ManyVoice was verified compatible by comparing
its symbol table against Lyra's id by id, which was true and not sufficient:
matching tokens say the phonemes will mean the same thing, not that the runtime
will accept the file. The lesson is the same one this repository keeps
relearning -- load it and see, rather than reason about whether it should work.

Needs `pip install onnx`.
"""
import json
import sys

import onnx

# What sherpa reads out of a vits model. Values come from the Piper config
# except the three that are constant for every Piper voice.
def metadata(config: dict) -> dict:
    return {
        'model_type': 'vits',
        'comment': 'piper',
        'language': 'English',
        # Piper voices are phonemised by eSpeak, and sherpa needs telling which
        # voice of it to use -- 'en' is British-leaning, 'en-us' American.
        'has_espeak': '1',
        'voice': config.get('espeak', {}).get('voice', 'en'),
        'sample_rate': str(config['audio']['sample_rate']),
        'n_speakers': str(config.get('num_speakers', 1)),
    }


def main() -> int:
    if len(sys.argv) != 4:
        print(__doc__.strip())
        return 2

    source, config_path, out = sys.argv[1:]
    with open(config_path, encoding='utf-8') as handle:
        config = json.load(handle)

    model = onnx.load(source)
    existing = {prop.key for prop in model.metadata_props}
    if existing:
        # Re-adding a key leaves two entries with the same name and sherpa reads
        # whichever it finds first, so refuse rather than produce a file whose
        # behaviour depends on ordering.
        print(f'{source} already carries metadata ({", ".join(sorted(existing))}).')
        return 1

    added = metadata(config)
    for key, value in added.items():
        entry = model.metadata_props.add()
        entry.key = key
        entry.value = value

    onnx.save(model, out)
    print(f'{out}')
    for key, value in added.items():
        print(f'  {key:<12} {value}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
