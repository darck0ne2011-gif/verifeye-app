/**
 * Voice Clone Detection: ffprobe audio metadata + DeepSeek reasoning.
 * No Python/Sightengine. Uses audio metadata (bitrate, sample rate, silence gaps) and Lip-Sync score.
 */

import { getAudioMetadata } from './audioMetadataService.js'
import { getVoiceCloneReasoning } from './deepseekAnalyst.js'

/**
 * Analyze audio for Voice Clone Detection via DeepSeek.
 * Extracts audio metadata (ffprobe) and sends to DeepSeek with Lip-Sync score.
 * @param {Buffer} videoBuffer - Video file buffer
 * @param {string} ext - File extension (mp4, mov, etc.)
 * @param {object} options - { lipSyncScore?: number } - Lip-Sync integrity 0-1
 * @returns {{ reasoning: string, source: string } | null} - DeepSeek reasoning or null
 */
export async function classifyAudioWithSightengine(videoBuffer, ext = 'mp4', options = {}) {
  try {
    const audioMetadata = await getAudioMetadata(videoBuffer, ext)
    if (!audioMetadata?.hasAudio) {
      return { reasoning: 'No audio track detected.', source: 'deepseek' }
    }

    const lipSyncScore = options?.lipSyncScore ?? null
    const reasoning = await getVoiceCloneReasoning(audioMetadata, lipSyncScore)
    if (reasoning) {
      return { reasoning, source: 'deepseek' }
    }

    // Fallback when DeepSeek unavailable
    const bitrate = audioMetadata.bitrate ?? 'N/A'
    const sampleRate = audioMetadata.sampleRate ?? 'N/A'
    return {
      reasoning: `Audio metadata: bitrate ${bitrate} bps, sample rate ${sampleRate} Hz. Lip-Sync: ${lipSyncScore != null ? Math.round(lipSyncScore * 100) : 'N/A'}%. DeepSeek analysis unavailable.`,
      source: 'metadata_only',
    }
  } catch (err) {
    console.warn('AudioScanner:', err.message)
    return null
  }
}
