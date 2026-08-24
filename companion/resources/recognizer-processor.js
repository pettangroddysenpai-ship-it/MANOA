// AudioWorklet : capture micro 16k mono -> messages IPC vers vosk-browser.
// Exemple officiel de vosk-browser (examples/modern-vanilla/recognizer-processor.js).

class RecognizerAudioProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super(options);
    this.port.onmessage = this._processMessage.bind(this);
  }

  _processMessage(event) {
    if (event.data.action === 'init') {
      this._recognizerId = event.data.recognizerId;
      if (event.ports && event.ports[0]) {
        this._recognizerPort = event.ports[0];
      }
    }
  }

  process(inputs, outputs, parameters) {
    const data = inputs[0][0];
    if (this._recognizerPort && data) {
      // les echantillons sont des float32 entre -1 et 1 ; vosk attend int16
      const audioArray = data.map((value) => value * 0x8000);
      this._recognizerPort.postMessage(
        {
          action: 'audioChunk',
          data: audioArray,
          recognizerId: this._recognizerId,
          sampleRate,
        },
        { transfer: [audioArray.buffer] },
      );
    }
    return true;
  }
}

registerProcessor('recognizer-processor', RecognizerAudioProcessor);
