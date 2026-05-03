import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')

async function loadJson(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath)
  const content = await fs.readFile(absolutePath, 'utf8')
  return JSON.parse(content)
}

async function loadModule(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath)
  return import(pathToFileURL(absolutePath).href)
}

async function main() {
  const grsaiModule = await loadModule('lib/modules/image/adapters/grsai-shared.ts')
  const aliyunModule = await loadModule('lib/modules/image/adapters/aliyun-wan-27-shared.ts')
  const volcengineModule = await loadModule('lib/modules/image/adapters/volcengine-images-v1-shared.ts')
  const aliyunVideoModule = await loadModule('lib/modules/video/adapters/aliyun-wan-27-video-shared.ts')

  const grsaiGptBody = grsaiModule.buildGrsaiGptImageBody({
    model: 'gpt-image-2',
    prompt: 'test prompt',
    size: '1:1',
    outputFormat: 'png',
    responseFormat: 'url',
    watermark: false,
    sequentialImageGeneration: 'disabled',
    optimizePromptMode: 'standard',
    enableWebSearch: false,
  })
  assert.equal(grsaiGptBody.model, 'gpt-image-2')
  assert.equal(grsaiGptBody.size, '1:1')

  const grsaiNanoBody = grsaiModule.buildGrsaiNanoBananaBody({
    model: 'nano-banana-pro',
    prompt: 'test prompt',
    size: '16:9@2K',
    outputFormat: 'png',
    responseFormat: 'url',
    watermark: false,
    sequentialImageGeneration: 'disabled',
    optimizePromptMode: 'standard',
    enableWebSearch: false,
  })
  assert.equal(grsaiNanoBody.aspectRatio, '16:9')
  assert.equal(grsaiNanoBody.imageSize, '2K')

  const aliyunBody = aliyunModule.buildAliyunWan27ImageBody({
    model: 'wan2.7-image',
    prompt: 'aliyun prompt',
    images: ['https://example.com/ref.png'],
    bboxList: [[[0, 0, 100, 100]]],
    size: '2048x2048',
    outputFormat: 'png',
    responseFormat: 'url',
    watermark: true,
    sequentialImageGeneration: 'auto',
    maxImages: 4,
    optimizePromptMode: 'standard',
    enableWebSearch: false,
  })
  assert.equal(aliyunBody.parameters.n, 4)
  assert.equal(aliyunBody.parameters.enable_sequential, true)

  const volcengineBody = volcengineModule.buildVolcengineImagesV1Body({
    model: 'doubao-seedream-5-0-260128',
    prompt: 'volcengine prompt',
    images: ['https://example.com/ref-1.png', 'https://example.com/ref-2.png'],
    size: '2K',
    outputFormat: 'png',
    responseFormat: 'url',
    watermark: false,
    sequentialImageGeneration: 'auto',
    maxImages: 3,
    optimizePromptMode: 'standard',
    enableWebSearch: true,
  })
  assert.equal(volcengineBody.sequential_image_generation_options.max_images, 3)
  assert.deepEqual(volcengineBody.tools, [{ type: 'web_search' }])

  const grsaiGptFixture = await loadJson('lib/modules/image/adapters/__fixtures__/grsai-gpt-image-success.json')
  assert.equal(grsaiGptFixture.results[0].url, 'https://example.com/generated-gpt-image.png')

  const grsaiGptFailedFixture = await loadJson('lib/modules/image/adapters/__fixtures__/grsai-gpt-image-failed.json')
  assert.equal(grsaiGptFailedFixture.status, 'failed')
  assert.equal(grsaiGptFailedFixture.failure_reason, 'input_moderation')
  assert.equal(grsaiGptFailedFixture.results.length, 0)

  const grsaiNanoFixture = await loadJson('lib/modules/image/adapters/__fixtures__/grsai-nano-banana-success.json')
  assert.equal(grsaiNanoFixture.results[0].url, 'https://example.com/generated-nano-banana.png')

  const grsaiNanoRunningFixture = await loadJson(
    'lib/modules/image/adapters/__fixtures__/grsai-nano-banana-running.json'
  )
  assert.equal(grsaiNanoRunningFixture.status, 'running')
  assert.equal(grsaiNanoRunningFixture.progress, 45)

  const aliyunFixture = await loadJson('lib/modules/image/adapters/__fixtures__/aliyun-image-success.json')
  assert.equal(aliyunFixture.output.choices[0].message.content[0].image, 'https://example.com/generated-aliyun-image.png')

  const aliyunFailedFixture = await loadJson('lib/modules/image/adapters/__fixtures__/aliyun-image-failed.json')
  assert.equal(aliyunFailedFixture.code, 'InvalidParameter')
  assert.equal(aliyunFailedFixture.message, 'Invalid image generation parameters')

  const aliyunEmptyFixture = await loadJson('lib/modules/image/adapters/__fixtures__/aliyun-image-empty-output.json')
  assert.deepEqual(aliyunEmptyFixture.output.choices[0].message.content, [])
  assert.equal(aliyunEmptyFixture.usage.image_count, 0)

  const volcengineFixture = await loadJson('lib/modules/image/adapters/__fixtures__/volcengine-image-success.json')
  assert.equal(volcengineFixture.data[0].url, 'https://example.com/generated-volcengine-image.png')

  const volcengineItemErrorFixture = await loadJson(
    'lib/modules/image/adapters/__fixtures__/volcengine-image-item-error.json'
  )
  assert.equal(volcengineItemErrorFixture.data[0].error.code, 'OutputModeration')
  assert.equal(volcengineItemErrorFixture.usage.generated_images, 0)

  const aliyunVideoBody = aliyunVideoModule.buildAliyunWan27CreateTaskBody({
    model: 'wan2.7-t2v',
    prompt: 'video prompt',
    mode: 'text_to_video',
    ratio: '16:9',
    resolution: '1080p',
    duration: 5,
    watermark: true,
    promptExtend: true,
  })
  assert.equal(aliyunVideoBody.model, 'wan2.7-t2v')
  assert.equal(aliyunVideoBody.parameters.resolution, '1080P')
  assert.equal(aliyunVideoBody.parameters.ratio, '16:9')
  assert.deepEqual(aliyunVideoBody.input.media, [])

  const aliyunVideoSucceededFixture = await loadJson(
    'lib/modules/video/adapters/__fixtures__/aliyun-video-succeeded.json'
  )
  const normalizedAliyunSucceeded = aliyunVideoModule.normalizeAliyunWan27IncomingTask(
    aliyunVideoSucceededFixture
  )
  assert.equal(normalizedAliyunSucceeded.status, 'SUCCEEDED')
  assert.equal(normalizedAliyunSucceeded.video_path, 'https://example.com/generated-aliyun-video.mp4')
  assert.equal(aliyunVideoModule.mapAliyunWan27StatusToLocal(normalizedAliyunSucceeded.status), 'succeeded')
  assert.equal(aliyunVideoModule.getAliyunWan27TaskGenerationTimeSeconds(normalizedAliyunSucceeded), 12)

  const aliyunVideoRunningFixture = await loadJson(
    'lib/modules/video/adapters/__fixtures__/aliyun-video-running.json'
  )
  const normalizedAliyunRunning = aliyunVideoModule.normalizeAliyunWan27IncomingTask(
    aliyunVideoRunningFixture
  )
  assert.equal(normalizedAliyunRunning.status, 'RUNNING')
  assert.equal(normalizedAliyunRunning.video_path, null)
  assert.equal(aliyunVideoModule.mapAliyunWan27StatusToLocal(normalizedAliyunRunning.status), 'processing')

  const aliyunVideoFailedFixture = await loadJson(
    'lib/modules/video/adapters/__fixtures__/aliyun-video-failed.json'
  )
  const normalizedAliyunFailed = aliyunVideoModule.normalizeAliyunWan27IncomingTask(
    aliyunVideoFailedFixture
  )
  assert.equal(normalizedAliyunFailed.status, 'FAILED')
  assert.equal(normalizedAliyunFailed.error_message, 'Video generation failed moderation')
  assert.equal(aliyunVideoModule.mapAliyunWan27StatusToLocal(normalizedAliyunFailed.status), 'failed')
  assert.equal(aliyunVideoModule.getAliyunWan27TaskGenerationTimeSeconds(normalizedAliyunFailed), 7)

  const volcengineVideoSucceededFixture = await loadJson(
    'lib/modules/video/adapters/__fixtures__/volcengine-video-succeeded.json'
  )
  assert.equal(volcengineVideoSucceededFixture.status, 'succeeded')
  assert.equal(volcengineVideoSucceededFixture.content.video_url, 'https://example.com/generated-volcengine-video.mp4')
  assert.equal(volcengineVideoSucceededFixture.updated_at - volcengineVideoSucceededFixture.created_at, 12)

  const volcengineVideoRunningFixture = await loadJson(
    'lib/modules/video/adapters/__fixtures__/volcengine-video-running.json'
  )
  assert.equal(volcengineVideoRunningFixture.status, 'queued')
  assert.equal(volcengineVideoRunningFixture.content.video_url, undefined)

  const volcengineVideoFailedFixture = await loadJson(
    'lib/modules/video/adapters/__fixtures__/volcengine-video-failed.json'
  )
  assert.equal(volcengineVideoFailedFixture.status, 'failed')
  assert.equal(volcengineVideoFailedFixture.error.code, 'OutputModeration')
  assert.equal(volcengineVideoFailedFixture.updated_at - volcengineVideoFailedFixture.created_at, 8)

  console.log('provider fixture checks passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
