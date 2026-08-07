CREATE TABLE "WorkItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkItem_pkey" PRIMARY KEY ("id")
);
