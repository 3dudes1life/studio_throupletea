(function () {
  'use strict';

  class MediaController {
    constructor(options) {
      this.video = options.video;
      this.meter = options.meter;
      this.cameraSelect = options.cameraSelect || null;
      this.micSelect = options.micSelect || null;
      this.onStatus = typeof options.onStatus === 'function' ? options.onStatus : function () {};
      this.stream = null;
      this.audioContext = null;
      this.animationFrame = null;
      this.micMuted = false;
      this.cameraOff = false;
      this.boundCameraChange = () => this.restart();
      this.boundMicChange = () => this.restart();
      if (this.cameraSelect) this.cameraSelect.addEventListener('change', this.boundCameraChange);
      if (this.micSelect) this.micSelect.addEventListener('change', this.boundMicChange);
    }

    constraints() {
      const cameraId = this.cameraSelect && this.cameraSelect.value;
      const micId = this.micSelect && this.micSelect.value;
      return {
        video: cameraId ? { deviceId: { exact: cameraId }, width: { ideal: 1280 }, height: { ideal: 720 } } : { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: micId ? { deviceId: { exact: micId }, echoCancellation: true, noiseSuppression: true, autoGainControl: true } : { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      };
    }

    async start() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        this.onStatus({ ready: false, error: 'Camera and microphone testing requires HTTPS or localhost.' });
        throw new Error('Media devices are unavailable.');
      }
      await this.stop();
      try {
        this.stream = await navigator.mediaDevices.getUserMedia(this.constraints());
        this.video.srcObject = this.stream;
        await this.video.play().catch(() => {});
        this.micMuted = false;
        this.cameraOff = false;
        await this.populateDevices();
        this.startMeter();
        this.onStatus({
          ready: true,
          camera: this.stream.getVideoTracks().length > 0,
          microphone: this.stream.getAudioTracks().length > 0,
          cameraLabel: this.stream.getVideoTracks()[0] ? this.stream.getVideoTracks()[0].label : '',
          micLabel: this.stream.getAudioTracks()[0] ? this.stream.getAudioTracks()[0].label : ''
        });
        return this.stream;
      } catch (error) {
        this.onStatus({ ready: false, error: error.message || 'Camera or microphone permission was denied.' });
        throw error;
      }
    }

    async restart() {
      try {
        await this.start();
      } catch (error) {
        console.warn('Could not restart selected media devices.', error);
      }
    }

    async populateDevices() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.fillSelect(this.cameraSelect, devices.filter((device) => device.kind === 'videoinput'), 'Camera');
      this.fillSelect(this.micSelect, devices.filter((device) => device.kind === 'audioinput'), 'Microphone');
    }

    fillSelect(select, devices, fallback) {
      if (!select) return;
      const current = select.value;
      select.innerHTML = '';
      devices.forEach((device, index) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = device.label || `${fallback} ${index + 1}`;
        select.appendChild(option);
      });
      if (current && Array.from(select.options).some((option) => option.value === current)) select.value = current;
    }

    startMeter() {
      if (!this.meter || !this.stream || !this.stream.getAudioTracks().length) return;
      this.stopMeter();
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.audioContext = new AudioContext();
      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 256;
      const source = this.audioContext.createMediaStreamSource(this.stream);
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const average = data.reduce((total, value) => total + value, 0) / data.length;
        const width = Math.min(100, Math.max(3, average * 1.7));
        this.meter.style.width = `${width}%`;
        this.animationFrame = requestAnimationFrame(tick);
      };
      tick();
    }

    stopMeter() {
      if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
      if (this.audioContext) this.audioContext.close().catch(() => {});
      this.audioContext = null;
      if (this.meter) this.meter.style.width = '3%';
    }

    setMicMuted(muted) {
      this.micMuted = Boolean(muted);
      if (this.stream) this.stream.getAudioTracks().forEach((track) => { track.enabled = !this.micMuted; });
      return this.micMuted;
    }

    setCameraOff(off) {
      this.cameraOff = Boolean(off);
      if (this.stream) this.stream.getVideoTracks().forEach((track) => { track.enabled = !this.cameraOff; });
      return this.cameraOff;
    }

    async stop() {
      this.stopMeter();
      if (this.stream) this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
      if (this.video) this.video.srcObject = null;
    }

    destroy() {
      this.stop();
      if (this.cameraSelect) this.cameraSelect.removeEventListener('change', this.boundCameraChange);
      if (this.micSelect) this.micSelect.removeEventListener('change', this.boundMicChange);
    }
  }

  window.TTMediaController = MediaController;
}());
