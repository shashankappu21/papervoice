package expo.modules.sherpatts

import com.k2fsa.sherpa.onnx.OfflineTts
import com.k2fsa.sherpa.onnx.OfflineTtsConfig
import com.k2fsa.sherpa.onnx.OfflineTtsModelConfig
import com.k2fsa.sherpa.onnx.OfflineTtsVitsModelConfig
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

/**
 * Wraps sherpa-onnx so a Piper voice can turn one sentence into a WAV on disk.
 *
 * Every path handed in is an absolute path in the app's own storage: the models
 * are downloaded or pushed there, never bundled, and never read over a network.
 */
class SherpaTtsModule : Module() {
  private var tts: OfflineTts? = null

  override fun definition() = ModuleDefinition {
    Name("SherpaTts")

    AsyncFunction("load") { model: String, tokens: String, dataDir: String, numThreads: Int ->
      tts?.release()
      tts = null

      if (!File(model).exists()) throw CodedException("Model not found: $model")
      if (!File(tokens).exists()) throw CodedException("Tokens not found: $tokens")
      if (!File(dataDir).exists()) throw CodedException("espeak-ng data not found: $dataDir")

      val config = OfflineTtsConfig(
        model = OfflineTtsModelConfig(
          vits = OfflineTtsVitsModelConfig(
            model = model,
            tokens = tokens,
            dataDir = dataDir,
          ),
          numThreads = numThreads,
          debug = false,
          provider = "cpu",
        ),
      )

      // A null AssetManager means "read these paths from the filesystem".
      val engine = OfflineTts(assetManager = null, config = config)
      tts = engine

      mapOf(
        "sampleRate" to engine.sampleRate(),
        "numSpeakers" to engine.numSpeakers(),
      )
    }

    AsyncFunction("synthesize") { text: String, sid: Int, speed: Float, outPath: String ->
      val engine = tts ?: throw CodedException("SherpaTts.load() must be called first")

      val startedAt = System.currentTimeMillis()
      val audio = engine.generate(text, sid, speed)
      if (!audio.save(outPath)) throw CodedException("Could not write the WAV file: $outPath")

      val durationSec = audio.samples.size.toDouble() / audio.sampleRate.toDouble()
      val elapsedSec = (System.currentTimeMillis() - startedAt) / 1000.0

      mapOf(
        "path" to outPath,
        "durationSec" to durationSec,
        // Real-time factor: below 1 means synthesis outruns playback.
        "rtf" to if (durationSec > 0) elapsedSec / durationSec else 0.0,
      )
    }

    AsyncFunction("unload") {
      tts?.release()
      tts = null
    }

    OnDestroy {
      tts?.release()
      tts = null
    }
  }
}
