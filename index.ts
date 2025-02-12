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
  uploadString,
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

const uploadM3u8File = async (
  refPath: string,
  file: string,
  type: string
): Promise<Record<string, string>> => {
  return await new Promise((resolve, reject) => {
    uploadString(ref(storage, refPath), file, "raw", {
      contentType: "application/vnd.apple.mpegurl",
    })
      .then(async (snapshot) => {
        const downloadURL = await getDownloadURL(snapshot.ref);
        resolve({ src: downloadURL, type: type });
      })
      .catch((err) => reject(err));
  });
};

const uploadMedia = async (
  refPath: string,
  file: Blob | string,
  type: string
): Promise<Record<string, string>> => {
  const storageRef = ref(storage, refPath);
  return new Promise(function (resolve, reject) {
    const uploadTask = uploadBytesResumable(
      storageRef,
      typeof file === "string" ? new Blob([file], { type: type }) : file
    );
    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress =
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.clear();
        console.log(`Upload is ${progress.toFixed(2)}% done`);
      },
      (error) => {
        reject(error);
      },
      async () => {
        await getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
          let data = { src: downloadURL, type: type };
          resolve(data);
        });
      }
    );
  });
};

// const setItem = async (refPath: string, data: any) => {
//   const path = `clients/jacob-cache-test/media/fjfjleoOIonflkdl`;

//   try {
//     await setDoc(doc(db, path), data);
//   } catch (error) {
//     console.log(error);
//   }
// };

// const getItem = (refPath: string, setDoc: (doc: any) => void): Unsubscribe => {
//   const path = `clients/jacob-cache-test/media/fjfjleoOIonflkdl`.replace(
//     "//",
//     "/"
//   );
//   return onSnapshot(doc(db, path), (doc) => {
//     setDoc({
//       id: doc.id,
//       _docId: doc.id,
//       _refPath: doc.ref.path,
//       ...doc.data(),
//     });
//   });
// };

async function storeFile(
  refPath: string,
  fileBlob: Blob | string,
  type: string
) {
  const uniquePath = `${Date.now().toString(36)}${Math.random()
    .toString(36)
    .substring(2, 8)}`;
  const result: Record<string, string | any> = await uploadMedia(
    `${refPath}/${uniquePath}`,
    fileBlob,
    type
  );
  return { result, refPath: `${refPath}/${uniquePath}` };
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

async function convertToM3U8(
  inputBuffer: Buffer,
  refPath: string
): Promise<string[]> {
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
          "-hls_flags",
          "delete_segments",
          "pipe:1",
        ],
        { stdio: ["pipe", "pipe", "pipe", "pipe"] }
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

      let m3u8Chunks: Buffer[] = [];

      let int = 0;
      const tid = setInterval(() => {
        int++;
      }, 1000);

      ffmpeg.stdout.on("data", (chunks) => {
        m3u8Chunks.push(chunks);
      });

      ffmpeg.on("close", async (code) => {
        clearInterval(tid);
        console.log("Elapsed time", int >= 60 ? int / 60 + "m" : int + "s");
        const m3u8Manifest = Buffer.concat(m3u8Chunks);
        const base = m3u8Manifest.toString("utf-8").split("#EXTM3U");
        const binaryData = [...base];
        binaryData.pop();

        const utfEncoded = base
          .at(-1)
          .split("\n")
          .filter((n) => n);
        utfEncoded.unshift("#EXTM3U");
        const parseableFile = utfEncoded.join("\n");

        console.log("Successfully compressed and converted");
        resolve([parseableFile, binaryData.join("")]);
      });
    } catch (err) {
      console.error("ERROR CONVERTING TO M3U8: ", err);
      reject(new Error("Error on stdio stream for m3u8 conversion: " + err));
    }
  });
}

async function runScript(file: string): Promise<Buffer> {
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

/*

* LOGICAL FLOW
 * 1. take input file and run first command which compresses and spits out a buffer
 * 2. then i convert that buffer to an m3u8 file and keep it as a buffer
 * 3. then i generate the ts files, and add the refpath and download url to an object in an array,
 * 4. then i convert the buffer of m3u8 file to utf-8, replace the semgments with the correct download urls
 * 5. 

*/

const map = { manifest: {}, tsFile: {} };
async function main(refPath: string, fileName: string) {
  try {
    const buffer: Buffer = await runScript(fileName);
    const [parseableFile, binaryData]: string[] = await convertToM3U8(
      buffer,
      refPath
    );
    const mediaRef = await storeFile(
      refPath,
      new Blob([binaryData], { type: "MP2T" }),
      "MP2T"
    );
    map.tsFile = mediaRef;
    const tsDownloadURL = mediaRef?.result?.src;
    const fileToParse = parseableFile.split("\n");
    const len = fileToParse.length;
    for (let i: number = 0; i < len; i++) {
      const currentLineInFile = fileToParse[i];
      const regex = /pipe:/i;
      if (regex.test(currentLineInFile)) {
        fileToParse[i] = tsDownloadURL;
      }
    }
    const fileToInsert = fileToParse.join("\n");
    const res = await uploadM3u8File(refPath, fileToInsert, 'application/vnd.apple.mpegurl');
    console.log(res);
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

main(refPath, fileName);

