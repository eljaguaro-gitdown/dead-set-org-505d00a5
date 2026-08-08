/**
 * JS handle for the app-embedded NativeAudio Capacitor plugin
 * (ios/App/App/NativeAudioPlugin.swift). Only meaningful inside the native
 * shell — on the web, the proxy exists but every call would reject, so
 * callers must gate on isNativeApp().
 */
import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";

export interface NativeTrack {
  id: string;
  url: string;
  title?: string;
  artist?: string;
  album?: string;
  artworkUrl?: string;
}

export interface NativeAudioPlugin {
  load(options: { tracks: NativeTrack[]; startIndex: number; autoplay: boolean }): Promise<void>;
  append(options: { track: NativeTrack }): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(options: { seconds: number }): Promise<void>;
  gotoIndex(options: { index: number; autoplay: boolean }): Promise<void>;
  setVolume(options: { volume: number }): Promise<void>;
  stop(): Promise<void>;
  getState(): Promise<{ index: number; isPlaying: boolean; currentTime: number; duration: number }>;
  addListener(
    eventName: "trackChanged",
    listener: (data: { id: string; index: number }) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "playbackState",
    listener: (data: { isPlaying: boolean }) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "progress",
    listener: (data: { currentTime: number; duration: number }) => void,
  ): Promise<PluginListenerHandle>;
  addListener(eventName: "queueEnded", listener: () => void): Promise<PluginListenerHandle>;
  addListener(
    eventName: "error",
    listener: (data: { message: string }) => void,
  ): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}

export const NativeAudio = registerPlugin<NativeAudioPlugin>("NativeAudio");
