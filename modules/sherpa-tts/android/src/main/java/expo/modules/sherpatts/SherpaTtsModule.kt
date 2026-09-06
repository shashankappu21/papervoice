package expo.modules.sherpatts

import com.k2fsa.sherpa.onnx.GeneratedAudio
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

    /**
     * Synthesises one sentence, which may arrive already cut into pieces at
     * clause boundaries so no single job is enormous, and writes it as one WAV.
     *
     * One file per sentence is what lets playback line up exactly with the text
     * on screen: a track index is a sentence index.
     */
    AsyncFunction("synthesize") { parts: List<String>, sid: Int, speed: Float, outPath: String, seamMs: Int, tailMs: Int ->
      val engine = tts ?: throw CodedException("SherpaTts.load() must be called first")
      if (parts.isEmpty()) throw CodedException("Nothing to synthesize")

      val startedAt = System.currentTimeMillis()
      val pieces = parts.map { engine.generate(it, sid, speed) }
      val elapsedSec = (System.currentTimeMillis() - startedAt) / 1000.0

      val sampleRate = pieces.first().sampleRate
      val speechSamples = pieces.sumOf { it.samples.size }
      val seam = sampleRate * seamMs / 1000
      val tail = sampleRate * tailMs / 1000

      val total = speechSamples + seam * (pieces.size - 1) + tail
      val samples = FloatArray(total)
      var at = 0
      for ((i, piece) in pieces.withIndex()) {
        piece.samples.copyInto(samples, at)
        at += piece.samples.size
        // Silence is written into the audio rather than left to the player,
        // which cannot be relied on to leave a gap of any particular length.
        if (i < pieces.size - 1) at += seam
      }

      if (!GeneratedAudio(samples, sampleRate).save(outPath)) {
        throw CodedException("Could not write the WAV file: $outPath")
      }

      mapOf(
        "path" to outPath,
        // How long the track takes to play, silence included.
        "durationSec" to total.toDouble() / sampleRate.toDouble(),
        // Real-time factor, measured against the speech alone: padding the
        // audio must not be allowed to flatter the number.
        "rtf" to if (speechSamples > 0) elapsedSec / (speechSamples.toDouble() / sampleRate) else 0.0,
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
