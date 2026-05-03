CREATE INDEX "Asset_userId_createdAt_idx" ON "Asset"("userId", "createdAt");
CREATE INDEX "Asset_userId_type_createdAt_idx" ON "Asset"("userId", "type", "createdAt");
CREATE INDEX "Asset_userId_category_createdAt_idx" ON "Asset"("userId", "category", "createdAt");
CREATE INDEX "Asset_userId_category_subjectType_createdAt_idx" ON "Asset"("userId", "category", "subjectType", "createdAt");

CREATE INDEX "GenerationTask_userId_createdAt_idx" ON "GenerationTask"("userId", "createdAt");
CREATE INDEX "GenerationTask_userId_status_createdAt_idx" ON "GenerationTask"("userId", "status", "createdAt");

CREATE INDEX "ImageGenerationTask_userId_createdAt_idx" ON "ImageGenerationTask"("userId", "createdAt");
CREATE INDEX "ImageGenerationTask_userId_status_createdAt_idx" ON "ImageGenerationTask"("userId", "status", "createdAt");
