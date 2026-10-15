export type LinkedImageReference = {
  name: string;
  relativePath?: string;
  fileSize?: number;
};

export type LinkedFileCandidate = {
  name: string;
  webkitRelativePath?: string;
  size: number;
};

export const isDefaultProjectName = (name: string) =>
  !name.trim() || /^untitled[\s_-]*wb[\s_-]*figure$/i.test(name.trim());

export const projectNameFromFiles = (
  files: Array<{ name: string; webkitRelativePath?: string }>,
  date = new Date(),
) => {
  const folderName = files
    .map((file) => file.webkitRelativePath?.split("/").filter(Boolean)[0])
    .find(Boolean)
    ?.normalize("NFKC")
    .trim();
  if (folderName) return folderName;
  const year = date.getFullYear(),
    month = String(date.getMonth() + 1).padStart(2, "0"),
    day = String(date.getDate()).padStart(2, "0");
  return `WB-${year}${month}${day}`;
};

export const safeProjectFileStem = (name: string, fallback = "WB-project") =>
  name
    .normalize("NFKC")
    .trim()
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.\-\s]+|[.\-\s]+$/g, "") || fallback;

const normalizePath = (value = "") =>
  value
    .normalize("NFKC")
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .toLowerCase();

const withoutRoot = (value: string) =>
  value.split("/").filter(Boolean).slice(1).join("/");

export function chooseLinkedFile<T extends LinkedFileCandidate>(
  image: LinkedImageReference,
  captureFolder: string | undefined,
  candidates: T[],
) {
  const referencePath = normalizePath(image.relativePath || image.name),
    referenceTail = withoutRoot(referencePath),
    folderPath = captureFolder
      ? normalizePath([captureFolder, image.name].join("/"))
      : "",
    scored = candidates
      .map((file) => {
        const filePath = normalizePath(file.webkitRelativePath || file.name),
          fileTail = withoutRoot(filePath);
        let score = 0;
        if (filePath === referencePath) score = 100;
        else if (referenceTail && fileTail === referenceTail) score = 90;
        else if (folderPath && filePath.endsWith(folderPath)) score = 80;
        else if (normalizePath(file.name) === normalizePath(image.name)) score = 50;
        if (score && image.fileSize && file.size === image.fileSize) score += 5;
        return { file, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);
  if (!scored.length) return undefined;
  if (
    scored.length > 1 &&
    scored[0].score === scored[1].score &&
    scored[0].score < 80
  )
    return undefined;
  return scored[0].file;
}

export function createLinkedProjectSnapshot<T>(project: T): T & {
  projectStorage: {
    format: "linked-images";
    version: 1;
    savedAt: string;
  };
} {
  const snapshot = structuredClone(project) as T & {
    projectStorage?: {
      format: "linked-images";
      version: 1;
      savedAt: string;
    };
    captures?: Array<{
      clPreview?: string;
      cl?: Record<string, unknown>;
      merge?: Record<string, unknown>;
      m?: Record<string, unknown>;
      regions?: Array<{ adjustment?: Record<string, unknown> }>;
    }>;
  };
  snapshot.projectStorage = {
    format: "linked-images",
    version: 1,
    savedAt: new Date().toISOString(),
  };
  snapshot.captures?.forEach((capture) => {
    delete capture.clPreview;
    (["cl", "merge", "m"] as const).forEach((role) => {
      const image = capture[role];
      if (!image) return;
      delete image.data;
      delete image.tiffData;
    });
    capture.regions?.forEach((region) => {
      if (region.adjustment) delete region.adjustment.preview;
    });
  });
  return snapshot as T & {
    projectStorage: {
      format: "linked-images";
      version: 1;
      savedAt: string;
    };
  };
}
