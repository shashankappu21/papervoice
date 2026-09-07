package expo.modules.sherpatts

import com.k2fsa.sherpa.onnx.GeneratedAudio
import com.k2fsa.sherpa.onnx.OfflineTts
import com.k2fsa.sherpa.onnx.OfflineTtsConfig
import com.k2fsa.sherpa.onnx.OfflineTtsKittenModelConfig
import com.k2fsa.sherpa.onnx.OfflineTtsKokoroModelConfig
import com.k2fsa.sherpa.onnx.OfflineTtsModelConfig
import com.k2fsa.sherpa.onnx.OfflineTtsVitsModelConfig
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.security.MessageDigest

/**
 * Wraps sherpa-onnx so a Piper voice can turn one sentence into a WAV on disk.
 *
 * Every path handed in is an absolute path in the app's own storage: the models
 * are downloaded or pushed there, never bundled, and never read over a network.
 */
private const val ESPEAK_ASSET = "espeak-ng-data"

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
    /**
     * Loads a Kokoro voice, which is a different shape of model: one file holds
     * the speaker embeddings for every voice it can do, so `voices` sits beside
     * the model rather than a speaker being baked into it.
     */
    AsyncFunction("loadKokoro") { model: String, voices: String, tokens: String, dataDir: String, lexicon: String, lang: String, numThreads: Int ->
      tts?.release()
      tts = null

      // dataDir and lexicon are each optional and are passed empty to turn one
      // off: a Kokoro voice can be phonemised by espeak or by its own lexicon,
      // and which of the two is right is decided by listening, not by guessing.
      for (path in listOf(model, voices, tokens)) {
        if (!File(path).exists()) throw CodedException("Not found: $path")
      }
      for (optional in listOf(dataDir, lexicon)) {
        if (optional.isNotEmpty() && !File(optional).exists()) {
          throw CodedException("Not found: $optional")
        }
      }

      val config = OfflineTtsConfig(
        model = OfflineTtsModelConfig(
          kokoro = OfflineTtsKokoroModelConfig(
            model = model,
            voices = voices,
            tokens = tokens,
            dataDir = dataDir,
            // A lexicon is how the multi-language models pronounce their own
            // language; the English-only ones do without it.
            lexicon = lexicon,
            lang = lang,
          ),
          numThreads = numThreads,
          debug = false,
          provider = "cpu",
        ),
      )

      val engine = OfflineTts(assetManager = null, config = config)
      tts = engine

      mapOf(
        "sampleRate" to engine.sampleRate(),
        "numSpeakers" to engine.numSpeakers(),
      )
    }

    /**
     * Loads a Kitten voice: a small model whose speakers live in a file beside
     * it, the same arrangement as Kokoro but a fraction of the size.
     */
    AsyncFunction("loadKitten") { model: String, voices: String, tokens: String, dataDir: String, numThreads: Int ->
      tts?.release()
      tts = null

      for (path in listOf(model, voices, tokens, dataDir)) {
        if (!File(path).exists()) throw CodedException("Not found: $path")
      }

      val config = OfflineTtsConfig(
        model = OfflineTtsModelConfig(
          kitten = OfflineTtsKittenModelConfig(
            model = model,
            voices = voices,
            tokens = tokens,
            dataDir = dataDir,
          ),
          numThreads = numThreads,
          debug = false,
          provider = "cpu",
        ),
      )

      val engine = OfflineTts(assetManager = null, config = config)
      tts = engine

      mapOf(
        "sampleRate" to engine.sampleRate(),
        "numSpeakers" to engine.numSpeakers(),
      )
    }

    AsyncFunction("synthesize") { parts: List<String>, sid: Int, speed: Float, outPath: String, seamMs: Int, tailMs: Int, trim: Float ->
      val engine = tts ?: throw CodedException("SherpaTts.load() must be called first")
      if (parts.isEmpty()) throw CodedException("Nothing to synthesize")

      val startedAt = System.currentTimeMillis()
      val pieces = parts.map { trimTail(engine.generate(it, sid, speed), trim) }
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

    /**
     * Copies the bundled phonemiser data out of the app package and onto the
     * filesystem, where sherpa-onnx opens it by path, and answers with that
     * path. Does nothing if it is already there, so it costs once per install.
     */
    AsyncFunction("installEspeakData") { destination: String ->
      val target = File(destination)
      val marker = File(target, "phontab")
      if (!marker.exists()) {
        target.deleteRecursively()
        copyAsset(ESPEAK_ASSET, target)
      }
      target.absolutePath
    }

    /**
     * Hashes a file so a download can be checked before it is trusted. Done
     * here because a 63MB model has no business being read through JavaScript.
     */
    AsyncFunction("sha256") { path: String ->
      val digest = MessageDigest.getInstance("SHA-256")
      File(path).inputStream().use { input ->
        val buffer = ByteArray(1 shl 16)
        while (true) {
          val read = input.read(buffer)
          if (read <= 0) break
          digest.update(buffer, 0, read)
        }
      }
      digest.digest().joinToString("") { "%02x".format(it) }
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

  /** Recursively copies an asset directory to the filesystem. */
  private fun copyAsset(assetPath: String, target: File) {
    val assets = appContext.reactContext?.assets
      ?: throw CodedException("No Android context to read assets from")

    val children = assets.list(assetPath) ?: emptyArray()
    if (children.isEmpty()) {
      // A file rather than a directory: assets.list() is empty for both, and
      // this is what tells them apart.
      target.parentFile?.mkdirs()
      assets.open(assetPath).use { input ->
        target.outputStream().use { output -> input.copyTo(output) }
      }
      return
    }

    target.mkdirs()
    for (child in children) {
      copyAsset("$assetPath/$child", File(target, child))
    }
  }

  /**
   * Cuts the noise some models leave after the words have finished.
   *
   * Kitten ends an utterance with roughly a third of a second of low, breathy
   * sound. Silence after it does not hide it -- the listener hears the sentence
   * end and then something else -- so it is cut off before the pause is added.
   *
   * `threshold` is a fraction of the utterance's own loudest moment, so a quiet
   * sentence is judged against itself rather than an absolute level. Zero turns
   * trimming off. At most a fraction of a second is ever removed, so a mistake
   * costs a clipped breath rather than a swallowed word.
   */
  private fun trimTail(audio: GeneratedAudio, threshold: Float): GeneratedAudio {
    if (threshold <= 0f || audio.samples.isEmpty()) return audio

    val samples = audio.samples
    var peak = 0f
    for (sample in samples) peak = maxOf(peak, kotlin.math.abs(sample))
    if (peak == 0f) return audio

    val floor = peak * threshold
    val mostRemovable = audio.sampleRate / 2 // half a second
    val limit = maxOf(0, samples.size - mostRemovable)

    var end = samples.size
    while (end > limit && kotlin.math.abs(samples[end - 1]) < floor) end--
    if (end == samples.size) return audio

    // Leave a little of the decay, so the last consonant is not clipped short.
    val guard = audio.sampleRate / 50 // 20ms
    val keep = minOf(samples.size, end + guard)
    return GeneratedAudio(samples.copyOfRange(0, keep), audio.sampleRate)
  }
}
