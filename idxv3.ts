import { spawn } from "child_process";
import "dotenv/config";
import path from "path";
import os from "os";
import chokidar from "chokidar";
import fs from "fs";


function executeScript(inputFile: string) {
  const env = process.env.ENVIRONMENT || "DEV";
  const fileOutput = (file: string) =>
    env === "DEV" ? `tmp/${file}` : path.join(os.tmpdir(), file);
  const watcher = chokidar.watch(env === 'DEV' ? 'tmp' : os.tmpdir(), {persistent: true})
  try {
    let int = 0;
    const iid = setInterval(() => {
      int++;
    }, 1000);
    watcher.on("add", async(fileName) => {
      console.log(`new file added ${fileName}`);
      fs.unlink(fileName, (err) => {
        if (err) {
          console.error('Error during file conversion in unlinking in tmp directory: ' + err);
        }
      })
    })
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
      console.log(data.toString());
    });
    ffmpeg.stderr.on("data", (data) => {
      console.log(data.toString());
    });
    ffmpeg.on("error", (err) => {
      clearInterval(iid);
      console.error("Process closed with error: ", err);
    });
    ffmpeg.on("close", async(data) => {
      clearInterval(iid);
      const minutes = Math.floor(int / 60);
      const seconds = int - minutes * 60;
      console.log("elapsed time: ", int + " second(s)");
      console.log("elapsed time: ", minutes + " min " + seconds + " second(s)");
      console.log("Process closed with no error: ", data);
      await watcher.close().then(() => console.log('file watcher closed'));
    });
  } catch (err) {
    console.error(err);
    return err;
  }
}

executeScript(process.argv.at(-1));
