const IMAGE_MENTION_PATTERN = /@图片(\d+)/g
const VIDEO_MENTION_PATTERN = /@视频(\d+)/g
const AUDIO_MENTION_PATTERN = /@音频(\d+)/g

export function normalizePromptForProvider(prompt: string) {
  if (!prompt) {
    return ''
  }

  return prompt
    .replace(IMAGE_MENTION_PATTERN, (_, index: string) => `图${index}`)
    .replace(VIDEO_MENTION_PATTERN, (_, index: string) => `视频${index}`)
    .replace(AUDIO_MENTION_PATTERN, (_, index: string) => `音频${index}`)
}
