-- Baseline migration for the open-source release.
-- New installations can initialize the full schema from this file directly.

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "totalTokens" BIGINT NOT NULL DEFAULT 0,
    "usedTokens" BIGINT NOT NULL DEFAULT 0,
    "totalBudget" BIGINT NOT NULL DEFAULT 0,
    "usedBudget" BIGINT NOT NULL DEFAULT 0,
    "seedanceApiKey" TEXT,
    "seedanceApiUrl" TEXT NOT NULL DEFAULT 'https://ark.cn-beijing.volces.com',
    "defaultVideoProviderId" TEXT NOT NULL DEFAULT 'volcengine',
    "storageProviderId" TEXT NOT NULL DEFAULT 'tos',
    "maxConcurrentTasks" INTEGER NOT NULL DEFAULT 5,
    "maxRequestsPerMinute" INTEGER NOT NULL DEFAULT 20,
    "memberCooldownSeconds" INTEGER NOT NULL DEFAULT 10,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "allocatedTokens" BIGINT NOT NULL DEFAULT 0,
    "usedTokens" BIGINT NOT NULL DEFAULT 0,
    "reservedTokens" BIGINT NOT NULL DEFAULT 0,
    "allocatedBudget" BIGINT NOT NULL DEFAULT 0,
    "usedBudget" BIGINT NOT NULL DEFAULT 0,
    "reservedBudget" BIGINT NOT NULL DEFAULT 0,
    "teamId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "duration" REAL,
    "contentType" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'creation',
    "subjectType" TEXT,
    "subjectName" TEXT,
    "sourceAssetId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Asset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GenerationTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT,
    "mode" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'doubao-seedance-2-0-260128',
    "modelKey" TEXT,
    "providerId" TEXT NOT NULL DEFAULT 'volcengine',
    "providerModelId" TEXT,
    "prompt" TEXT NOT NULL,
    "promptAst" TEXT,
    "ratio" TEXT NOT NULL DEFAULT '16:9',
    "duration" INTEGER NOT NULL DEFAULT 5,
    "resolution" TEXT NOT NULL DEFAULT '480p',
    "watermark" BOOLEAN NOT NULL DEFAULT false,
    "generateAudio" BOOLEAN NOT NULL DEFAULT true,
    "seed" BIGINT NOT NULL DEFAULT -1,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "externalId" TEXT,
    "outputUrl" TEXT,
    "errorMessage" TEXT,
    "generationTime" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "estimatedTokens" INTEGER,
    "billingType" TEXT,
    "estimatedCostCents" INTEGER,
    "actualCostCents" INTEGER,
    "costYuan" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "GenerationTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImageGenerationTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "model" TEXT NOT NULL DEFAULT 'doubao-seedream-5-0-260128',
    "modelKey" TEXT,
    "providerId" TEXT NOT NULL DEFAULT 'volcengine',
    "providerModelId" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'text_to_image',
    "prompt" TEXT NOT NULL,
    "promptAst" TEXT,
    "size" TEXT NOT NULL DEFAULT '2K',
    "outputFormat" TEXT NOT NULL DEFAULT 'jpeg',
    "responseFormat" TEXT NOT NULL DEFAULT 'url',
    "watermark" BOOLEAN NOT NULL DEFAULT false,
    "sequentialImageGeneration" TEXT NOT NULL DEFAULT 'disabled',
    "maxImages" INTEGER,
    "optimizePromptMode" TEXT NOT NULL DEFAULT 'standard',
    "enableWebSearch" BOOLEAN NOT NULL DEFAULT false,
    "editConfigJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "generatedImages" INTEGER,
    "outputTokens" INTEGER,
    "totalTokens" INTEGER,
    "costYuan" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "ImageGenerationTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImageGenerationTaskReference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "taskId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    CONSTRAINT "ImageGenerationTaskReference_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ImageGenerationTask" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ImageGenerationTaskReference_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImageGenerationTaskOutput" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sortOrder" INTEGER NOT NULL,
    "sourceUrl" TEXT,
    "size" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "taskId" TEXT NOT NULL,
    "assetId" TEXT,
    CONSTRAINT "ImageGenerationTaskOutput_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ImageGenerationTask" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ImageGenerationTaskOutput_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeamProviderConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "providerId" TEXT NOT NULL,
    "apiKeyEncrypted" TEXT,
    "apiUrl" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "teamId" TEXT NOT NULL,
    CONSTRAINT "TeamProviderConfig_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StoryboardProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'script',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "language" TEXT NOT NULL DEFAULT 'zh',
    "mode" TEXT NOT NULL DEFAULT 'dialogue',
    "ratio" TEXT NOT NULL DEFAULT '16:9',
    "themeId" TEXT NOT NULL DEFAULT 'custom',
    "themeLabel" TEXT,
    "minShotCount" INTEGER,
    "content" TEXT,
    "coverUrl" TEXT,
    "modeLabel" TEXT,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "isOwned" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "StoryboardProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StoryboardShot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sortOrder" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "visual" TEXT NOT NULL,
    "narration" TEXT,
    "duration" INTEGER NOT NULL DEFAULT 5,
    "shotType" TEXT,
    "cameraAngle" TEXT,
    "movement" TEXT,
    "prompt" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "projectId" TEXT NOT NULL,
    CONSTRAINT "StoryboardShot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "StoryboardProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StoryboardShotAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shotId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    CONSTRAINT "StoryboardShotAsset_shotId_fkey" FOREIGN KEY ("shotId") REFERENCES "StoryboardShot" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StoryboardShotAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_TaskAssets" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_TaskAssets_A_fkey" FOREIGN KEY ("A") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_TaskAssets_B_fkey" FOREIGN KEY ("B") REFERENCES "GenerationTask" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_apiKey_key" ON "User"("apiKey");

-- CreateIndex
CREATE INDEX "GenerationTask_batchId_idx" ON "GenerationTask"("batchId");

-- CreateIndex
CREATE INDEX "ImageGenerationTaskReference_taskId_idx" ON "ImageGenerationTaskReference"("taskId");

-- CreateIndex
CREATE INDEX "ImageGenerationTaskReference_assetId_idx" ON "ImageGenerationTaskReference"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "ImageGenerationTaskReference_taskId_sortOrder_key" ON "ImageGenerationTaskReference"("taskId", "sortOrder");

-- CreateIndex
CREATE INDEX "ImageGenerationTaskOutput_taskId_idx" ON "ImageGenerationTaskOutput"("taskId");

-- CreateIndex
CREATE INDEX "ImageGenerationTaskOutput_assetId_idx" ON "ImageGenerationTaskOutput"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "ImageGenerationTaskOutput_taskId_sortOrder_key" ON "ImageGenerationTaskOutput"("taskId", "sortOrder");

-- CreateIndex
CREATE INDEX "TeamProviderConfig_teamId_idx" ON "TeamProviderConfig"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamProviderConfig_teamId_providerId_key" ON "TeamProviderConfig"("teamId", "providerId");

-- CreateIndex
CREATE INDEX "StoryboardProject_userId_updatedAt_idx" ON "StoryboardProject"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "StoryboardShot_projectId_sortOrder_idx" ON "StoryboardShot"("projectId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "StoryboardShot_projectId_sortOrder_key" ON "StoryboardShot"("projectId", "sortOrder");

-- CreateIndex
CREATE INDEX "StoryboardShotAsset_shotId_idx" ON "StoryboardShotAsset"("shotId");

-- CreateIndex
CREATE INDEX "StoryboardShotAsset_assetId_idx" ON "StoryboardShotAsset"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "StoryboardShotAsset_shotId_sortOrder_key" ON "StoryboardShotAsset"("shotId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "StoryboardShotAsset_shotId_assetId_key" ON "StoryboardShotAsset"("shotId", "assetId");

-- CreateIndex
CREATE UNIQUE INDEX "_TaskAssets_AB_unique" ON "_TaskAssets"("A", "B");

-- CreateIndex
CREATE INDEX "_TaskAssets_B_index" ON "_TaskAssets"("B");
