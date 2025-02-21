import { spawn } from "child_process";
import "dotenv/config";
import path from "path";
import os from "os";
import chokidar from "chokidar";
import fs from "fs";
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import {
  getDownloadURL,
  getStorage,
  ref,
  uploadBytesResumable,
} from "firebase/storage";

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
const map = new Map();

const uploadMedia = async (
  refPath: string,
  file: Blob,
  type: string
): Promise<Record<string, string>> => {
  const storageRef = ref(storage, refPath);
  const uploadTaskSnapshot = await uploadBytesResumable(storageRef, file);
  const downloadURL = await getDownloadURL(uploadTaskSnapshot.ref);

  return { src: downloadURL, type };
};

async function executeScript(inputFile: string, _refPath: string) {
  const env = process.env.ENVIRONMENT || "DEV";
  const startCPU = process.cpuUsage();
  if (inputFile.split(".").at(-1) !== "mp4") {
    throw new Error("Unexpected file type");
  }
  const fileOutput = (file: string) =>
    env === "DEV" ? `tmp/${file}` : path.join(os.tmpdir(), file);
  const watcher = chokidar.watch(env === "DEV" ? "tmp" : os.tmpdir(), {
    persistent: true,
    ignored: (path, stats) => stats?.isFile() && !path.endsWith(".ts"),
  });
  try {
    let int = 0;
    let activeUpload = 0;
    const iid = setInterval(() => {
      int++;
    }, 1000);
    watcher.on("add", async (fileName) => {
      activeUpload++;
      // const buffer = await fs.promises.readFile(fileName);
      // const download_url = await uploadMedia(
      //   _refPath,
      //   new Blob([buffer], { type: "MP2T" }),
      //   "MP2T"
      // );
      // if (!download_url?.src) process.exit(1);
      await new Promise((resolve) => setTimeout(resolve, 2000))
      map.set(fileName.split("/")?.at(-1), "download_url?.src");
      await new Promise((resolve, reject) => {
        fs.unlink(fileName, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve("");
          }
        });
        activeUpload--;
      });
    });
    const ffmpeg = spawn(
      "ffmpeg",
      [
        "-i",
        inputFile,
        "-profile:v",
        "baseline",
        "-level",
        "3.0",
        "-start_number",
        "0",
        "-hls_time",
        "6",
        "-hls_list_size",
        "0",
        "-f",
        "hls",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-b:v",
        "5000k",
        "-maxrate",
        "5000k",
        "-bufsize",
        "10000k",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-hls_segment_filename",
        fileOutput("high_%03d.ts"),
        fileOutput("high.m3u8"),
      ],
      { stdio: ["pipe", "pipe", "pipe"] }
    );
    ffmpeg.stdout.on("data", (data) => {
      // console.log(data.toString());
    });
    ffmpeg.stderr.on("data", (data) => {
      // console.log(data.toString());
    });
    ffmpeg.on("error", (err) => {
      clearInterval(iid);
      console.error("Process closed with error: ", err);
    });

    ffmpeg.on("close", async (data) => {
      const interval_id = setInterval(async () => {
        if (activeUpload === 0) {
          clearInterval(interval_id);
          await watcher.close().then(() => console.log("file watcher closed"));
          const fileData = [];
          for (const entry of map.entries()) {
            fileData.push(entry);
          }
          const data_read: string = await new Promise((resolve, reject) => {
            fs.readFile(
              fileOutput("high.m3u8"),
              { encoding: "utf-8" },
              (err, data) => {
                if (err) reject(err);
                else resolve(data);
              }
            );
          });
          const dataParse1 = data_read?.split("\n");
          const len: number = dataParse1?.length;
          for (let i: number = 0; i < len; i++) {
            if (/^high_\d{3}\.ts$/i.test(dataParse1[i])) {
              const name = dataParse1?.[i]?.trim();
              console.log("map get ->", map.get(name));
              dataParse1[i] = map.get(name);
            }
          }
          await new Promise((resolve, reject) => {
            const dataToInsertIntoManifest = dataParse1.join("\n");
            fs.writeFile(
              fileOutput("high.m3u8"),
              dataToInsertIntoManifest,
              { encoding: "utf-8" },
              (err) => {
                if (err) reject(err);
                else resolve("completed");
              }
            );
          });
          clearInterval(iid);
          const minutes = Math.floor(int / 60);
          const seconds = int - minutes * 60;
          console.log("elapsed time: ", int + " second(s)");
          console.log(
            "elapsed time: ",
            minutes + " min " + seconds + " second(s)"
          );
          const endCpu = process.cpuUsage(startCPU);
          const totalCPUTime = (endCpu.user + endCpu.system) / 1e6;
          console.log(
            "High level estimate of cpu usage ->",
            (totalCPUTime / int) * 100 + "%"
          );
          console.log("Process closed with no error: ", data);
        }
      }, 1000);
    });
  } catch (err) {
    console.error(err);
    return err;
  }
}

const refPath = "jacob-cache-test/media";
executeScript(process.argv.at(-1), refPath);
