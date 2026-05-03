CREATE TABLE "CanvasProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "coverUrl" TEXT,
    "activeCanvasId" TEXT,
    "canvasDataJson" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'platform',
    "sourceMetaJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "CanvasProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "CanvasProject_userId_updatedAt_idx" ON "CanvasProject"("userId", "updatedAt");
