import { exec } from "child_process";
import { spawn } from "child_process";
import fs from "fs";
import os from "os";

import {
  getFirestore,
  onSnapshot,
  Unsubscribe,
  doc,
  setDoc,
} from "firebase/firestore";

import {
  ref,
  getDownloadURL,
  getStorage,
  uploadBytesResumable,
} from "firebase/storage";
import { initializeApp } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyCVaAByzO-nOFY6XaVXLgTYHiGxlUWkZII",
  authDomain: "popshap-kiosks-dev.firebaseapp.com",
  projectId: "popshap-kiosks-dev",
  storageBucket: "popshap-kiosks-dev.appspot.com",
  messagingSenderId: "827903591200",
  appId: "1:827903591200:web:a3a3dd97574a553fb64d45",
  measurementId: "G-X3G2G8FZJ4",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app, "popshap-kiosks-dev.appspot.com");

const uploadMedia = async (
  refPath: string,
  file: Blob
): Promise<Record<string, string>> => {
  const storageRef = ref(storage, refPath);
  return new Promise(function (resolve, reject) {
    const uploadTask = uploadBytesResumable(storageRef, file);
    uploadTask.on(
      "state_changed",
      (snapshot) => {},
      (error) => {
        reject(error);
      },
      async () => {
        await getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
          let data = { src: downloadURL, type: file.type };
          resolve(data);
        });
      }
    );
  });
};

const setItem = async (refPath: string, data: any) => {
  const path = `clients/jacob-cache-test/media/fjfjleoOIonflkdl`;

  try {
    await setDoc(doc(db, path), data);
  } catch (error) {
    console.log(error);
  }
};

const getItem = (refPath: string, setDoc: (doc: any) => void): Unsubscribe => {
  const path = `clients/jacob-cache-test/media/fjfjleoOIonflkdl`.replace(
    "//",
    "/"
  );
  return onSnapshot(doc(db, path), (doc) => {
    setDoc({
      id: doc.id,
      _docId: doc.id,
      _refPath: doc.ref.path,
      ...doc.data(),
    });
  });
};

async function storeFile(refPath: string, fileBlob: Blob) {
  const uniquePath = `${Date.now().toString(36)}${Math.random()
    .toString(36)
    .substring(2, 8)}`;
  const result: Record<string, string | any> = await uploadMedia(
    `${refPath}/${uniquePath}`,
    fileBlob
  );
  return { result, refPath: `${refPath}/${uniquePath}` };
}

async function generateUniquePath(refPath: string) {
  const uniquePath = `${Date.now().toString(36)}${Math.random()
    .toString(36)
    .substring(2, 8)}`;
  return `${refPath}/${uniquePath}`;
}

async function findSize(file: string): Promise<fs.Stats> {
  return await new Promise((resolve, reject) => {
    fs.stat(file, (err, stats) => {
      if (err) reject(err);
      else resolve(stats);
    });
  });
}
async function findMimeType(file: string): Promise<string> {
  const platform = os.platform();
  console.log("platform -> ", platform);
  if (platform === "linux") {
    return await new Promise((resolve, reject) => {
      exec(`file --mime-type ${file}`, (err, stdout, stderr) => {
        if (err || stderr) reject(err || stderr);
        else resolve(stdout);
      });
    });
  } else {
    if (file.split(".").at(-1) !== "mp4") {
      return await new Promise((resolve) =>
        resolve(`${file}: ${file.split(".").at(-1)}`)
      );
    } else {
      return await new Promise((resolve) => resolve(`${file}: video/mp4`));
    }
  }
}

async function convertToM3U8(inputBuffer: Buffer, refPath: string): Promise<Record<string, string | Record<string, string>>> {
  return await new Promise((resolve, reject) => {
    try {
      console.log("converting to m3u8");
      const ffmpeg = spawn(
        "ffmpeg",
        [
          "-i",
          `pipe:0`,
          "-codec",
          "copy",
          "-start_number",
          "0",
          "-hls_time",
          "10",
          "-hls_list_size",
          "0",
          "-f",
          "hls",
          "-hls_segment_filename",
          `segment_%03d.ts`,
          "pipe:1",
        ],
        { stdio: ["pipe", "pipe", "pipe"] }
      );

      ffmpeg.stdin.write(inputBuffer, (err) => {
        if (err) {
          console.error("Error writing to stdin", err);
          reject(err);
        } else {
          ffmpeg.stdin.end();
        }
      });

      ffmpeg.on("error", (err) => {
        console.error("FFmpeg process error:", err);
        reject(err);
      });

      let tsChunks: Buffer[] = [];
      let m3u8Chunks: Buffer[] = [];

      let int = 0;
      const tid = setInterval(() => {
        int++;
      }, 1000);

      ffmpeg.stdout.on("data", (chunks) => {
        m3u8Chunks.push(chunks);
      });

      ffmpeg.stderr.on("data", (data) => {
        // m3u8Chunks.push(data);
      });

      ffmpeg.on("close", async (code) => {
        clearInterval(tid);
        console.log("Elapsed time", int >= 60 ? int / 60 + "m" : int + "s");
        console.log(`Child process exited with code ${code}`);
        console.log("successfully compressed and converted");
        const tsFiles = Buffer.concat(tsChunks);
        const m3u8Manifest = Buffer.concat(m3u8Chunks);
        console.log(tsFiles);
        console.log(m3u8Manifest);
        const manifest = await storeFile(
          refPath,
          new Blob([m3u8Manifest], { type: "m3u8" })
        );
        console.log("Successfully compressed and converted");
        resolve(manifest);
      });
      // ffmpeg.stdin.write(inputBuffer);
      // ffmpeg.stdin.end();
    } catch (err) {
      console.error("ERROR CONVERTING TO M3U8: ", err);
      reject(new Error("Error on stdio stream for m3u8 conversion: " + err));
    }
  });
}

const writestreamMp4Variant = (refPath: string, uniqueFileName: string) => {};

async function runScript(refPath: string, file: string): Promise<Buffer> {
  return await new Promise(async (resolve, reject) => {
    try {
      const last_arg = file;

      const mimeTypeBody = await findMimeType(last_arg);
      const mimeType = mimeTypeBody.split(`${last_arg}:`)[1].trim();
      if (mimeType !== "video/mp4") {
        console.error("incorrect file type", mimeType);
        reject(new Error("Incorrect file type: " + mimeType));
      }
      console.log("Resolved mime type -> ", mimeType);

      const stats = await findSize(last_arg);
      const originalSize = stats.size;
      console.log("file size ->", originalSize + " bytes");

      const ffmpegConfig = {
        encoderLibrary: "libx264",
        encodingSpeed: "fast",
        crf: "20",
      };
      let int = 0;
      const ffmpeg = spawn(
        "ffmpeg",
        [
          "-i",
          last_arg,
          "-c:v",
          ffmpegConfig.encoderLibrary,
          "-preset",
          ffmpegConfig.encodingSpeed,
          "-crf",
          ffmpegConfig.crf,
          "-c:a",
          "copy",
          "-f",
          "mp4",
          "-movflags",
          "frag_keyframe+empty_moov",
          "pipe:1",
          "-y",
        ],
        { stdio: ["pipe", "pipe", "pipe"] }
      );
      const tid = setInterval(() => {
        int++;
      }, 1000);

      ffmpeg.stderr.on("data", (data) => {
        if (data.toString().includes("size=")) {
          const splitData = data
            .toString()
            .split(" ")
            .filter((n) => n);
          const indexOfSize = splitData.indexOf("size=") + 1;
          const currentSizeOfCompressedImage =
            +splitData[indexOfSize].replace(/kb/gi, "") * 1024;
          console.clear();
          const numerator = currentSizeOfCompressedImage - originalSize;
          const denominator = originalSize;
          const quotient = numerator / denominator;
          const percentage = 100 + quotient * 100;
          console.log(
            `${(isNaN(percentage) ? 100.0 : percentage).toFixed(2)}% complete`
          );
        } else {
          console.error(`stderr: ${data}`);
        }
      });

      let chunks: Buffer[] = [];
      ffmpeg.stdout.on("data", (chunk) => {
        chunks.push(chunk);
      });

      ffmpeg.on("close", async (code) => {
        clearInterval(tid);
        const compressionSize = await findSize(`${file}`);
        const formatBytes = (bytes: number, decimals = 2) => {
          if (bytes === 0) return "0 Bytes";

          const k = 1024;
          const dm = decimals < 0 ? 0 : decimals;
          const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

          const i = Math.floor(Math.log(bytes) / Math.log(k));

          return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${
            sizes[i]
          }`;
        };

        console.log(
          "Original size of uncompressed video -> ",
          formatBytes(originalSize)
        );
        console.log(
          "Final size of compressed video -> ",
          formatBytes(compressionSize.size)
        );
        console.log(
          "Original to compressed size difference -> ",
          formatBytes(originalSize - compressionSize.size)
        );
        console.log("Elapsed time", int >= 60 ? int / 60 + "m" : int + "s");
        console.log(`Child process exited with code ${code}`);
        const buffer = Buffer.concat(chunks);
        resolve(buffer);
      });
    } catch (err) {
      console.error("ERROR COMPRESSING FILE: ", err);
      reject(
        new Error(
          err?.message.includes("stdio")
            ? err?.message
            : "Error on stdio stream for compression script: " + err
        )
      );
    }
  });
}
const map = { manifest: {} };
async function main(refPath: string, fileName: string) {
  try {
    const buffer: Buffer = await runScript(refPath, fileName);
    const res: Record<string, string | Record<string, string>> =
      await convertToM3U8(buffer, refPath);
    map.manifest = res;
  } catch (err) {
    console.error("Uncaught error", err);
    const message = err?.message?.includes("stdio")
      ? err?.message
      : "Unknown error occurred";
    throw new Error(message + err);
  }
}

const refPath = "jacob-cache-test/media";
const fileName = process.argv.at(-1);
const changedFileName = "compressed_" + fileName;

main(refPath, fileName);
