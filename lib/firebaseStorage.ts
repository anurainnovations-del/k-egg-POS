import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "@/firebase-config";

export interface FirebaseUploadResult {
  path: string;
  url: string;
}

export const MEDIA_BUCKETS = {
  BRANCHES: "branches",
  MENU_ITEMS: "menu-items",
  INGREDIENTS: "ingredients",
  WORKERS: "workers",
  GENERAL: "general",
} as const;

export type MediaBucket = (typeof MEDIA_BUCKETS)[keyof typeof MEDIA_BUCKETS];

interface UploadOptions {
  bucket?: MediaBucket;
}

const sanitizeFileName = (name: string): string => {
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, "-");
  return safe || "image";
};

const getFileExtension = (file: File): string => {
  if (file.name.includes(".")) {
    return file.name.split(".").pop() || "jpg";
  }

  if (file.type === "image/png") return "png";
  if (file.type === "image/jpeg" || file.type === "image/jpg") return "jpg";
  return "jpg";
};

export const uploadToFirebaseStorage = async (
  file: File,
  options?: UploadOptions
): Promise<FirebaseUploadResult> => {
  const bucket = options?.bucket || MEDIA_BUCKETS.GENERAL;
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 10);
  const extension = getFileExtension(file);
  const original = sanitizeFileName(file.name.replace(/\.[^.]+$/, ""));
  const path = `${bucket}/${timestamp}-${random}-${original}.${extension}`;
  const storageRef = ref(storage, path);

  await uploadBytes(storageRef, file, {
    contentType: file.type || "image/jpeg",
    cacheControl: "public,max-age=31536000,immutable",
  });

  const url = await getDownloadURL(storageRef);
  return { path, url };
};
