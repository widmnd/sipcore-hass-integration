class AudioVisualizer {
    private shouldStop: boolean = false;
    private audioContext: AudioContext;
    private analyser: AnalyserNode;
    private renderRoot: HTMLElement | ShadowRoot;
    private visualValueCount;
    private visualMainElement;
    private visualElements: NodeListOf<HTMLElement> | undefined;
    private mediaStreamSource: MediaStreamAudioSourceNode | null = null;

    constructor(renderRoot: HTMLElement | ShadowRoot, stream: MediaStream, visualValueCount = 16) {
        this.shouldStop = false;
        this.renderRoot = renderRoot;
        this.visualValueCount = visualValueCount;
        this.visualMainElement = this.renderRoot.querySelector("#audioVisualizer");
        this.audioContext = new AudioContext();
        this.initDOM();
        this.analyser = this.audioContext.createAnalyser();
        this.connectStream(stream);
    }

    stop() {
        this.shouldStop = true;
        // Clean up audio context and disconnect media source
        if (this.mediaStreamSource) {
            this.mediaStreamSource.disconnect();
            this.mediaStreamSource = null;
        }
        if (this.audioContext.state !== "closed") {
            this.audioContext.close();
        }
    }

    initDOM() {
        if (this.visualMainElement) {
            this.visualMainElement.innerHTML = "";
            let i;
            for (i = 0; i < this.visualValueCount; ++i) {
                const elm = document.createElement("div");
                this.visualMainElement.appendChild(elm);
            }

            this.visualElements = this.renderRoot.querySelectorAll("#audioVisualizer div");
        }
    }

    processFrame(data: Uint8Array) {
        const dataMap: { [key: number]: number } = {
            0: 15,
            1: 10,
            2: 8,
            3: 9,
            4: 6,
            5: 5,
            6: 2,
            7: 1,
            8: 0,
            9: 4,
            10: 3,
            11: 7,
            12: 11,
            13: 12,
            14: 13,
            15: 14,
        };
        let i;
        for (i = 0; i < this.visualValueCount; ++i) {
            const mappedIndex = dataMap[i];
            // Add bounds checking to prevent accessing undefined indices
            if (mappedIndex === undefined || mappedIndex >= data.length || !this.visualElements || i >= this.visualElements.length) {
                console.warn(`Audio visualizer: invalid index mapping or element at position ${i}`);
                continue;
            }
            const value = Math.max(0, Math.min(1, data[mappedIndex] / 255)); // Clamp value between 0 and 1
            const elmStyles = this.visualElements[i].style;
            elmStyles.transform = `scaleY(${value})`;
            elmStyles.opacity = Math.max(0.25, value).toString();
        }
    }

    connectStream(stream: MediaStream) {
        this.mediaStreamSource = this.audioContext.createMediaStreamSource(stream);
        this.mediaStreamSource.connect(this.analyser);
        this.analyser.smoothingTimeConstant = 0.5;
        this.analyser.fftSize = 32;

        this.initRenderLoop();
    }

    initRenderLoop() {
        const frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
        const renderFrame = () => {
            this.analyser?.getByteFrequencyData(frequencyData);
            this.processFrame(frequencyData);

            if (this.shouldStop !== true) {
                requestAnimationFrame(renderFrame);
            }
        };
        requestAnimationFrame(renderFrame);
    }
}

export { AudioVisualizer };
