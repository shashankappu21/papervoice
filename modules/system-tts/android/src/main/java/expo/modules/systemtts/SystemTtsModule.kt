package expo.modules.systemtts

import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.speech.tts.Voice
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.util.Locale
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * The voice every phone already has.
 *
 * It is the floor the app stands on: something to read with from the moment it
 * installs, before anyone has downloaded anything. Like the neural engine, it
 * writes one WAV per sentence, so the queue, the highlight, the saved position
 * and the lock screen controls all work exactly the same way whichever voice is
 * speaking.
 */
class SystemTtsModule : Module() {
  private var engine: TextToSpeech? = null

  override fun definition() = ModuleDefinition {
    Name("SystemTts")

    AsyncFunction("listVoices") {
      val tts = awaitEngine()
      val voices = tts.voices ?: emptySet<Voice>()

      voices
        .filter { it.locale.language == Locale.ENGLISH.language }
        .sortedBy { it.name }
        .map { voice ->
          mapOf(
            "id" to voice.name,
            "locale" to voice.locale.toLanguageTag(),
            "country" to voice.locale.country,
            // 500 is Voice.QUALITY_VERY_HIGH; the scale is coarse but ordered.
            "quality" to voice.quality,
            /*
             * The one that matters. A network voice sends the text away to be
             * spoken, which is exactly what this app promises never to do, so
             * the caller has to be able to see it and refuse.
             */
            "needsNetwork" to voice.isNetworkConnectionRequired,
          )
        }
    }

    AsyncFunction("synthesize") { text: String, voiceId: String, outPath: String ->
      val tts = awaitEngine()

      tts.voices?.firstOrNull { it.name == voiceId }?.let { voice ->
        if (voice.isNetworkConnectionRequired) {
          throw CodedException("$voiceId speaks over the network, and this app does not send text away")
        }
        tts.voice = voice
      } ?: throw CodedException("No system voice named $voiceId")

      val file = File(outPath)
      file.parentFile?.mkdirs()

      val done = CountDownLatch(1)
      var failure: String? = null

      tts.setOnUtteranceProgressListener(
        object : UtteranceProgressListener() {
          override fun onStart(utteranceId: String?) = Unit
          override fun onDone(utteranceId: String?) = done.countDown()

          @Deprecated("Required by the base class", ReplaceWith(""))
          override fun onError(utteranceId: String?) {
            failure = "The system voice failed"
            done.countDown()
          }

          override fun onError(utteranceId: String?, errorCode: Int) {
            failure = "The system voice failed with code $errorCode"
            done.countDown()
          }
        },
      )

      val queued = tts.synthesizeToFile(text, null, file, "papervoice")
      if (queued != TextToSpeech.SUCCESS) throw CodedException("The system voice refused the text")
      if (!done.await(60, TimeUnit.SECONDS)) throw CodedException("The system voice timed out")
      failure?.let { throw CodedException(it) }

      mapOf("path" to outPath, "durationSec" to wavDuration(file))
    }

    OnDestroy {
      engine?.shutdown()
      engine = null
    }
  }

  /**
   * Starts the engine and waits for it, because TextToSpeech is only usable
   * after its callback and every function here needs it ready.
   */
  private fun awaitEngine(): TextToSpeech {
    engine?.let { return it }

    val context = appContext.reactContext ?: throw CodedException("No Android context")
    val ready = CountDownLatch(1)
    var status = TextToSpeech.ERROR

    val created = TextToSpeech(context) { result ->
      status = result
      ready.countDown()
    }

    if (!ready.await(15, TimeUnit.SECONDS)) throw CodedException("The system voice did not start")
    if (status != TextToSpeech.SUCCESS) throw CodedException("No system voice is available")

    engine = created
    return created
  }

  /** Reads the length from the WAV header rather than guessing from file size. */
  private fun wavDuration(file: File): Double {
    if (!file.exists() || file.length() <= 44) return 0.0
    val header = ByteArray(44)
    file.inputStream().use { it.read(header) }

    val little = { offset: Int, bytes: Int ->
      var value = 0L
      for (i in 0 until bytes) value = value or ((header[offset + i].toLong() and 0xff) shl (8 * i))
      value
    }

    val sampleRate = little(24, 4)
    val bytesPerSecond = little(28, 4)
    if (bytesPerSecond > 0) return (file.length() - 44).toDouble() / bytesPerSecond
    return if (sampleRate > 0) (file.length() - 44).toDouble() / (sampleRate * 2) else 0.0
  }
}
