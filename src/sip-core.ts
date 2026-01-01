import { UA, WebSocketInterface } from "jssip/lib/JsSIP";
import { RTCSessionEvent, CallOptions } from "jssip/lib/UA";
import { EndEvent, PeerConnectionEvent, IncomingEvent, IceCandidateEvent, RTCSession } from "jssip/lib/RTCSession";
import pjson from "../package.json";

const version = pjson.version;

console.info(
    `%c SIP-CORE %c ${version} `,
    "color: white; background: dodgerblue; font-weight: 700;",
    "color: dodgerblue; background: white; font-weight: 700;",
);

/** Enum representing the various states of a SIP call */
export enum CALLSTATE {
    IDLE = "idle",
    INCOMING = "incoming",
    OUTGOING = "outgoing",
    CONNECTING = "connecting",
    CONNECTED = "connected",
}

/** Enum representing the kind of audio device */
export enum AUDIO_DEVICE_KIND {
    INPUT = "audioinput",
    OUTPUT = "audiooutput",
}

/** Mapping of a Home Assistant username to a SIP user */
export interface User {
    ha_username: string;
    display_name: string;
    extension: string;
    password: string;
}

export interface ICEConfig extends RTCConfiguration {
    /** Timeout in milliseconds for ICE gathering */
    iceGatheringTimeout?: number;
}

/** Configuration for SIP Core */
export interface SIPCoreConfig {
    ice_config: ICEConfig;
    backup_user: User;
    users: User[];
    /** URL for incoming call ringtone */
    incomingRingtoneUrl: string;
    /** URL for outgoing call ringtone */
    outgoingRingtoneUrl: string;
    /** Output configuration */
    out: String;
    auto_answer: boolean;
    popup_config: Object | null;
    popup_override_component: string | null;
    /**
     * Whether to use video in SIP calls.
     * @experimental
     */
    sip_video: boolean;
    pbx_server: string;
    /**
     * Custom WebSocket URL to use when ingress is not setup
     *
     * @example
     * "wss://sip.example.com/ws"
     */
    custom_wss_url: string;
    /**
     * Heartbeat interval in milliseconds to keep the connection alive
     * @default 30000 (30 seconds)
     */
    heartbeatIntervalMs?: number;
}

/**
 * Main class for SIP Core functionality.
 * Handles SIP registration, call management, and audio device management.
 */
export class SIPCore {
    /**
     * The JSSIP User Agent instance
     * @see {@link https://jssip.net/documentation/3.1.x/api/ua/}
     */
    public ua!: UA;

    /**
     * The current RTC session, if available
     * @see {@link https://jssip.net/documentation/3.1.x/api/session/}
     */
    public RTCSession: RTCSession | null = null;

    public version: string = version;
    public hass: any;
    public user!: User;
    public config!: SIPCoreConfig;

    private heartBeatHandle: number | null = null;
    private heartBeatIntervalMs: number = 30000;

    private callTimerHandle: number | null = null;

    private wssUrl!: string;
    private iceCandidateTimeout: number | null = null;

    private locationChangedListener: ((e: any) => Promise<void>) | null = null;

    public remoteAudioStream: MediaStream | null = null;
    public remoteVideoStream: MediaStream | null = null;

    public incomingAudio: HTMLAudioElement | null = null;
    public outgoingAudio: HTMLAudioElement | null = null;

    constructor() {
        // Get hass instance
        const homeAssistant = document.querySelector("home-assistant");
        if (!homeAssistant) {
            throw new Error("Home Assistant element not found");
        }
        this.hass = (homeAssistant as any).hass;

        // Bind event handlers to preserve 'this' context
        this.handleRemoteTrackEvent = this.handleRemoteTrackEvent.bind(this);
        this.handleIceGatheringStateChangeEvent = this.handleIceGatheringStateChangeEvent.bind(this);
    }

    /** Returns the remote extension. Returns `null` if not in a call */
    get remoteExtension(): string | null {
        return this.RTCSession?.remote_identity.uri.user || null;
    }

    /** Returns the remote display name if available, otherwise the extension. Returns `null` if not in a call */
    get remoteName(): string | null {
        return this.RTCSession?.remote_identity.display_name || this.RTCSession?.remote_identity.uri.user || null;
    }

    get registered(): boolean {
        return this.ua?.isRegistered() ?? false;
    }

    private async fetchWSSUrl(): Promise<string> {
        if (this.config.custom_wss_url) {
            console.debug("Using custom WSS URL:", this.config.custom_wss_url);
            return this.config.custom_wss_url;
        }

        // async fetch ingress entry
        const token = this.hass.auth.data.access_token;
        try {
            const resp = await fetch("/api/sip-core/asterisk-ingress", {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (resp.ok) {
                const data = await resp.json();
                const wssProtocol = window.location.protocol === "https:" ? "wss" : "ws";
                console.debug("Ingress entry fetched:", data.ingress_entry);
                return `${wssProtocol}://${window.location.host}${data.ingress_entry}/ws`;
            } else {
                throw new Error(`Failed to fetch ingress entry: ${resp.statusText}`);
            }
        } catch (error) {
            console.error("Error fetching ingress entry:", error);
            throw new Error("Failed to retrieve WebSocket URL: No ingress entry or custom WSS URL provided");
        }
    }

    private async callOptions(): Promise<CallOptions> {
        let micStream: MediaStream | undefined = undefined;
        if (this.AudioInputId !== null) {
            console.debug(`Using audio input device: ${this.AudioInputId}`);
            try {
                micStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        deviceId: { exact: this.AudioInputId },
                    },
                    video: this.config.sip_video,
                });
            } catch (err) {
                console.error(`Error getting audio input: ${err}`);
                micStream = undefined;
            }
        }

        if (this.AudioOutputId !== null) {
            console.debug(`Using audio output device: ${this.AudioOutputId}`);
            let audioElement = document.getElementById("remoteAudio") as any;
            if (audioElement) {
                try {
                    await audioElement.setSinkId(this.AudioOutputId);
                } catch (err) {
                    console.error(`Error setting audio output: ${err}`);
                }
            } else {
                console.warn("Remote audio element not found. Audio output device may not be set.");
            }
        }

        return {
            mediaConstraints: {
                audio: true,
                video: this.config.sip_video,
            },
            mediaStream: micStream,
            rtcConstraints: {
                offerToReceiveAudio: true,
                offerToReceiveVideo: this.config.sip_video,
            },
            pcConfig: this.config.ice_config,
        };
    }

    get callState(): CALLSTATE {
        if (this.RTCSession?.isEstablished()) {
            return CALLSTATE.CONNECTED;
        } else if (this.RTCSession?.connection?.connectionState === "connecting") {
            return CALLSTATE.CONNECTING;
        } else if (this.RTCSession?.isInProgress()) {
            return this.RTCSession?.direction === "incoming" ? CALLSTATE.INCOMING : CALLSTATE.OUTGOING;
        }
        return CALLSTATE.IDLE;
    }

    /** Returns call duration in format `0:00` */
    get callDuration(): string {
        if (this.RTCSession?.start_time) {
            var delta = Math.floor((Date.now() - this.RTCSession.start_time.getTime()) / 1000);
            var minutes = Math.floor(delta / 60);
            var seconds = delta % 60;
            return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
        }
        return "0:00";
    }

    get AudioOutputId(): string | null {
        return localStorage.getItem("sipcore-audio-output");
    }

    set AudioOutputId(deviceId: string | null) {
        if (deviceId === null) {
            localStorage.removeItem("sipcore-audio-output");
        } else {
            localStorage.setItem("sipcore-audio-output", deviceId);
        }
        console.debug(`Audio output set to ${deviceId}`);
    }

    get AudioInputId(): string | null {
        return localStorage.getItem("sipcore-audio-input");
    }

    set AudioInputId(deviceId: string | null) {
        if (deviceId === null) {
            localStorage.removeItem("sipcore-audio-input");
        } else {
            localStorage.setItem("sipcore-audio-input", deviceId);
        }
        console.debug(`Audio input set to ${deviceId}`);
    }

    private async setupAudio() {
        this.incomingAudio = new Audio(this.config.incomingRingtoneUrl);
        this.outgoingAudio = new Audio(this.config.outgoingRingtoneUrl);
        this.incomingAudio.loop = true;
        this.outgoingAudio.loop = true;

        let audioElement = document.createElement("audio") as any;
        audioElement.id = "remoteAudio";
        audioElement.autoplay = true;
        audioElement.style.display = "none";
        document.body.appendChild(audioElement);
    }

    private setupPopup() {
        let POPUP_COMPONENT = this.config.popup_override_component || "sip-call-dialog";
        if (document.getElementsByTagName(POPUP_COMPONENT).length < 1) {
            document.body.appendChild(document.createElement(POPUP_COMPONENT));
        }
    }

    private startCallTimer() {
        this.callTimerHandle = setInterval(() => {
            this.triggerUpdate();
        }, 1000);
    }

    private stopCallTimer() {
        if (this.callTimerHandle) {
            clearInterval(this.callTimerHandle);
            this.callTimerHandle = null;
        }
    }

    async init() {
        try {
            this.config = await this.fetchConfig(this.hass);
            
            // Validate backup_user configuration
            try {
                this.validateUser(this.config.backup_user, "backup_user in configuration");
            } catch (validationError) {
                console.error(validationError);
                throw validationError;
            }
            
            this.locationChangedListener = async () => {
                console.debug("View changed, refresh config...");
                try {
                    let new_config = await this.fetchConfig(this.hass);
                    if (JSON.stringify(new_config) !== JSON.stringify(this.config)) {
                        console.info("Configuration changed, reloading SIP Core...");
                        // Terminate any active calls before stopping UA
                        if (this.RTCSession) {
                            console.debug("Terminating active call before config reload...");
                            this.RTCSession.terminate();
                            this.RTCSession = null;
                        }
                        this.ua.stop();
                        this.config = new_config;
                        await this.setupUser();
                        this.wssUrl = await this.fetchWSSUrl();
                        console.debug(`Connecting to ${this.wssUrl}...`);
                        this.ua.start();
                        this.triggerUpdate();
                    }
                } catch (error) {
                    console.error("Error during config reload:", error);
                    // Attempt to reconnect if config reload fails
                    try {
                        this.ua.start();
                    } catch (reconnectError) {
                        console.error("Failed to reconnect after config reload error:", reconnectError);
                    }
                }
            };
            window.addEventListener("location-changed", this.locationChangedListener);
            
            this.wssUrl = await this.fetchWSSUrl();
            await this.createHassioSession();
            await this.setupAudio();
            await this.setupUser();

            console.debug(`Connecting to ${this.wssUrl}...`);
            this.ua.start();
            if (this.config.popup_config !== null) {
                this.setupPopup();
            }
            this.triggerUpdate();

            // autocall if set
            const autocall_extension = new URLSearchParams(window.location.search).get("call");
            if (autocall_extension) {
                console.info(`Autocalling ${autocall_extension}...`);
                try {
                    await this.startCall(autocall_extension);
                } catch (autocallError) {
                    console.error("Error autocalling:", autocallError);
                }
            }
        } catch (error) {
            console.error("Error initializing SIP Core:", error);
            throw error;
        }
    }

    /** Clean up resources and event listeners. Call before destroying the instance. */
    destroy() {
        if (this.locationChangedListener) {
            window.removeEventListener("location-changed", this.locationChangedListener);
            this.locationChangedListener = null;
        }
        if (this.heartBeatHandle) {
            clearInterval(this.heartBeatHandle);
            this.heartBeatHandle = null;
        }
        if (this.callTimerHandle) {
            clearInterval(this.callTimerHandle);
            this.callTimerHandle = null;
        }
        if (this.iceCandidateTimeout) {
            clearTimeout(this.iceCandidateTimeout);
            this.iceCandidateTimeout = null;
        }
        if (this.ua) {
            this.ua.stop();
        }
    }

    private async setupUser(): Promise<void> {
        try {
            console.debug("setupUser(): start");
            const personsResult = await this.hass.callWS({ type: "person/list" });

            console.debug("Raw personsResult:", personsResult);

            // Normalize possible shapes returned by different HA versions / containers
            let persons: any[] = [];
            if (personsResult && Array.isArray((personsResult as any).storage)) {
                persons = (personsResult as any).storage;
            } else if (personsResult && Array.isArray((personsResult as any).data)) {
                persons = (personsResult as any).data;
            } else if (Array.isArray(personsResult)) {
                persons = personsResult;
            }

            // Filter out any non-object or falsy entries to avoid runtime errors
            persons = (persons || []).filter((p) => p && typeof p === "object");

            console.debug(`setupUser(): normalized persons count=${persons.length}`);

            try {
                const hassUserId = this.hass?.user?.id;
                const matchedPerson = persons.find((person: any) => person && person.user_id === hassUserId);

                // Prefer person.id, fallback to hass user name/id
                let currentUsername: string | undefined;
                if (matchedPerson && typeof matchedPerson.id === "string") {
                    currentUsername = matchedPerson.id;
                } else {
                    currentUsername = this.hass?.user?.name || this.hass?.user?.username || this.hass?.user?.id;
                }

                // If person id is like 'person.john', strip prefix to match common `ha_username` values
                if (typeof currentUsername === "string" && currentUsername.startsWith("person.")) {
                    currentUsername = currentUsername.replace(/^person\./, "");
                }

                // Defensive: ensure config.users is an array
                const users = Array.isArray(this.config?.users) ? this.config.users : [];

                this.user = users.find((user) => user.ha_username === currentUsername) || this.getBackupUser();
            } catch (innerError) {
                console.error("Error processing personsResult:", innerError, { persons, hassUser: this.hass?.user });
                this.user = this.getBackupUser();
            }

            
        } catch (error) {
            console.error("Error fetching persons from Home Assistant:", error);
            this.user = this.getBackupUser();
        }
        
        // Validate the selected user
        try {
            this.validateUser(this.user, "selected user");
        } catch (validationError) {
            console.error(validationError);
            throw validationError;
        }
        
        console.debug(`Selected user: ${this.user?.ha_username} (${this.user?.extension})`);
        this.ua = this.setupUA();
    }

    private async fetchConfig(hass: any): Promise<SIPCoreConfig> {
        const token = hass.auth.data.access_token;
        try {
            const resp = await fetch("/api/sip-core/config?t=" + Date.now(), {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (resp.ok) {
                const config: SIPCoreConfig = await resp.json();
                console.debug("SIP-Core Config fetched:", config);
                return config;
            } else {
                throw new Error(`Failed to fetch SIP Core config: ${resp.statusText}`);
            }
        } catch (error) {
            console.error("Error fetching SIP Core configuration:", error);
            throw error;
        }
    }

    playIncomingRingtone(): void {
        if (this.incomingAudio) {
            this.incomingAudio.play().catch((error) => {
                console.error("Incoming ringtone failed:", error);
            });
        }
    }

    stopIncomingRingtone(): void {
        if (this.incomingAudio) {
            this.incomingAudio.pause();
            this.incomingAudio.currentTime = 0;
        }
    }

    playOutgoingTone(): void {
        if (this.outgoingAudio) {
            this.outgoingAudio.play().catch((error) => {
                console.error("Outgoing tone failed:", error);
            });
        }
    }

    stopOutgoingTone(): void {
        if (this.outgoingAudio) {
            this.outgoingAudio.pause();
            this.outgoingAudio.currentTime = 0;
        }
    }

    async answerCall() {
        if (this.callState !== CALLSTATE.INCOMING) {
            console.warn("Not in incoming call state. Cannot answer.");
            return;
        }
        this.RTCSession?.answer(await this.callOptions());
        this.triggerUpdate();
    }

    async endCall() {
        this.RTCSession?.terminate();
        this.triggerUpdate();
    }

    async startCall(extension: string) {
        // Validate extension format
        if (!extension || typeof extension !== "string") {
            throw new Error("Invalid extension: extension must be a non-empty string");
        }

        // Extension should be alphanumeric and may contain some special chars like + or - for SIP URIs
        // Allow basic SIP URI format or just the extension number
        const isValidExtension = /^[a-zA-Z0-9+*#\-._~%!$&'()*+,;=:@/?]+$/.test(extension);
        if (!isValidExtension) {
            throw new Error(`Invalid extension format: "${extension}" contains invalid characters`);
        }

        // Check if it looks like a complete SIP URI or just an extension
        // If it doesn't contain @, assume it's just an extension number and log it
        if (!extension.includes("@")) {
            console.debug(`Calling extension: ${extension}`);
        } else {
            console.debug(`Calling SIP URI: ${extension}`);
        }

        try {
            this.ua.call(extension, await this.callOptions());
        } catch (error) {
            console.error(`Error initiating call to ${extension}:`, error);
            throw error;
        }
    }

    /** Dispatches a `sipcore-update` event */
    triggerUpdate() {
        window.dispatchEvent(new Event("sipcore-update"));
    }

    private setupUA(): UA {
        const socket = new WebSocketInterface(this.wssUrl);
        const ua = new UA({
            sockets: [socket],
            uri: `${this.user.extension}@${this.config.pbx_server || window.location.host}`,
            authorization_user: this.user.extension,
            display_name: this.user.display_name || this.user.ha_username,
            password: this.user.password,
            register: true,
        });

        ua.on("registered", (e) => {
            console.info("Registered");
            this.triggerUpdate();

            if (this.heartBeatHandle != null) {
                clearInterval(this.heartBeatHandle);
            }
            this.heartBeatHandle = setInterval(() => {
                console.debug("Sending heartbeat");
                socket.send("\n\n");
            }, this.config.heartbeatIntervalMs ?? this.heartBeatIntervalMs);
        });
        ua.on("unregistered", (e) => {
            console.warn("Unregistered");
            this.triggerUpdate();
            if (this.heartBeatHandle != null) {
                clearInterval(this.heartBeatHandle);
            }
        });
        ua.on("registrationFailed", (e) => {
            console.error("Registration failed:", e);
            this.triggerUpdate();
            if (this.heartBeatHandle != null) {
                clearInterval(this.heartBeatHandle);
                this.heartBeatHandle = null;
            }

            if (e.cause === "Connection Error") {
                console.error("Connection error. Retrying...");
                setTimeout(() => {
                    this.ua.start();
                }, 5000);
            }
        });
        ua.on("newRTCSession", (e: RTCSessionEvent) => {
            console.debug(`New RTC Session: ${e.originator}`);

            if (this.RTCSession !== null) {
                console.debug("Terminating new RTC session");
                e.session.terminate();
                return;
            }
            this.RTCSession = e.session;

            e.session.on("failed", (e: EndEvent) => {
                console.warn("Call failed:", e);
                window.dispatchEvent(new Event("sipcore-call-ended"));
                this.RTCSession = null;
                this.remoteVideoStream = null;
                this.remoteAudioStream = null;
                this.stopCallTimer();
                this.stopOutgoingTone();
                this.stopIncomingRingtone();
                this.triggerUpdate();
            });
            e.session.on("ended", (e: EndEvent) => {
                console.info("Call ended:", e);
                window.dispatchEvent(new Event("sipcore-call-ended"));
                this.RTCSession = null;
                this.remoteVideoStream = null;
                this.remoteAudioStream = null;
                this.stopCallTimer();
                this.stopOutgoingTone();
                this.stopIncomingRingtone();
                this.triggerUpdate();
            });
            e.session.on("accepted", (e: IncomingEvent) => {
                console.info("Call accepted");
                this.startCallTimer();
                this.stopOutgoingTone();
                this.stopIncomingRingtone();
                this.triggerUpdate();
            });

            e.session.on("icecandidate", (e: IceCandidateEvent) => {
                console.debug("ICE candidate:", e.candidate?.candidate);
                if (this.iceCandidateTimeout != null) {
                    clearTimeout(this.iceCandidateTimeout);
                }

                this.iceCandidateTimeout = setTimeout(() => {
                    console.debug("ICE stopped gathering candidates due to timeout");
                    e.ready();
                }, this.config.ice_config.iceGatheringTimeout || 5000);
            });

            window.dispatchEvent(new Event("sipcore-call-started"));

            switch (e.session.direction) {
                case "incoming":
                    console.info("Incoming call");
                    this.triggerUpdate();
                    this.playIncomingRingtone();

                    e.session.on("peerconnection", (e: PeerConnectionEvent) => {
                        console.debug("Incoming call peer connection established");

                        e.peerconnection.addEventListener("track", this.handleRemoteTrackEvent);
                        e.peerconnection.addEventListener(
                            "icegatheringstatechange",
                            this.handleIceGatheringStateChangeEvent,
                        );
                    });

                    if (this.config.auto_answer) {
                        console.info("Auto answering call...");
                        this.answerCall();
                    }
                    break;

                case "outgoing":
                    console.info("Outgoing call");
                    this.playOutgoingTone();
                    this.triggerUpdate();

                    e.session.connection.addEventListener("track", this.handleRemoteTrackEvent);
                    e.session.connection.addEventListener(
                        "icegatheringstatechange",
                        this.handleIceGatheringStateChangeEvent,
                    );
                    break;
            }
        });
        return ua;
    }

    private handleIceGatheringStateChangeEvent(e: any) {
        console.debug("ICE gathering state changed:", e.target?.iceGatheringState);
        if (e.target?.iceGatheringState === "complete") {
            console.debug("ICE gathering complete");
            if (this.iceCandidateTimeout != null) {
                clearTimeout(this.iceCandidateTimeout);
            }
        }
    }

    private async handleRemoteTrackEvent(e: RTCTrackEvent) {
        let stream: MediaStream;
        if (e.streams.length > 0) {
            console.debug(`Received remote streams amount: ${e.streams.length}. Using first stream...`);
            stream = e.streams[0];
        } else {
            console.debug("No associated streams. Creating new stream...");
            stream = new MediaStream();
            stream.addTrack(e.track);
        }

        let remoteAudio = document.getElementById("remoteAudio") as HTMLAudioElement;
        if (!remoteAudio) {
            console.warn("Remote audio element not found. Cannot attach remote audio stream.");
            return;
        }

        if (e.track.kind === "audio") {
            if (remoteAudio.srcObject !== stream) {
                this.remoteAudioStream = stream;
                remoteAudio.srcObject = stream;
                try {
                    await remoteAudio.play();
                } catch (err) {
                    console.error("Error starting audio playback: " + err);
                }
            }
        }

        if (e.track.kind === "video") {
            console.debug("Received remote video track");
            this.remoteVideoStream = stream;
        }

        this.triggerUpdate();
    }

    // borrowed from https://github.com/lovelylain/ha-addon-iframe-card/blob/main/src/hassio-ingress.ts
    private setIngressCookie(session: string): string {
        document.cookie = `ingress_session=${session};path=/api/hassio_ingress/;SameSite=Strict${
            location.protocol === "https:" ? ";Secure" : ""
        }`;
        return session;
    }

    private async createHassioSession(): Promise<void> {
        try {
            const resp: { session: string } = await this.hass.callWS({
                type: "supervisor/api",
                endpoint: "/ingress/session",
                method: "post",
            });
            this.setIngressCookie(resp.session);
        } catch (error) {
            if ((error as any)?.code === "unknown_command") {
                console.info("Home Assistant Supervisor API not available. Assuming not running on Home Assistant OS.");
            } else {
                console.error("Error creating Hass.io session:", error);
                throw error;
            }
        }
    }

    private async validateHassioSession(session: string) {
        await this.hass.callWS({
            type: "supervisor/api",
            endpoint: "/ingress/validate_session",
            method: "post",
            data: { session },
        });
        this.setIngressCookie(session);
    }

    /** Extract and normalize backup_user, handling both object and array forms */
    private getBackupUser(): User {
        let backupUser = this.config.backup_user as any;
        if (Array.isArray(backupUser)) {
            backupUser = backupUser[0];
        }
        this.validateUser(backupUser, "backup_user");
        return backupUser;
    }

    /** Validate that a User object has all required fields */
    private validateUser(user: any, userLabel: string): void {
        if (!user) {
            throw new Error(`Invalid ${userLabel}: user is null or undefined`);
        }
        const requiredFields = ["ha_username", "extension", "password"];
        for (const field of requiredFields) {
            if (typeof user[field] !== "string" || !user[field]) {
                throw new Error(`Invalid ${userLabel}: missing or invalid required field '${field}'`);
            }
        }
        // display_name is optional, but if provided, should be a string
        if (user.display_name && typeof user.display_name !== "string") {
            throw new Error(`Invalid ${userLabel}: 'display_name' must be a string`);
        }
    }

    /** Returns a list of audio devices of the specified kind */
    async getAudioDevices(audioKind: AUDIO_DEVICE_KIND) {
        console.debug(`Fetching audio devices of kind: ${audioKind}`);
        
        // Check if mediaDevices API is available
        if (!navigator.mediaDevices?.enumerateDevices) {
            throw new Error("MediaDevices API is not available. Ensure HTTPS is enabled and the browser supports this feature.");
        }
        
        try {
            // Try to enumerate devices - permissions may already be granted
            const devices = await navigator.mediaDevices.enumerateDevices();
            const filteredDevices = devices.filter((device) => device.kind === audioKind);
            
            // If we got devices with labels, no need to request permission
            if (filteredDevices.some((device) => device.label)) {
                return filteredDevices;
            }
            
            // If devices have no labels, we need to request permission
            console.debug("No device labels found, requesting microphone permission...");
            let stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach((track) => track.stop());
            
            // Enumerate again after permission granted - now we should have labels
            const updatedDevices = await navigator.mediaDevices.enumerateDevices();
            return updatedDevices.filter((device) => device.kind === audioKind);
        } catch (err) {
            console.error("Error fetching audio devices:", err);
            throw err;
        }
    }
}

/** @hidden */
const sipCore = new SIPCore();
await sipCore.init().catch((error) => {
    console.error("Error initializing SIP Core:", error);
});
(window as any).sipCore = sipCore;
export { sipCore };
