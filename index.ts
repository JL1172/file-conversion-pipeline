import { exec } from "child_process";
import { spawn } from "child_process";
import fs from "fs";
import os from "os";

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
      return await new Promise((resolve) => resolve(`${file}: ${file.split(".").at(-1)}`));
    } else {
      return await new Promise((resolve) => resolve(`${file}: video/mp4`));
    }
  }
}

async function runScript(file: string) {
  try {
    //! this is by command line the insertion can be different though it doesn't matter
    const last_arg = file;

    const mimeTypeBody = await findMimeType(last_arg);
    const mimeType = mimeTypeBody.split(`${last_arg}:`)[1].trim();
    if (mimeType !== "video/mp4") {
      console.error("incorrect file type", mimeType);
      process.exit(1);
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
        `compressed_${last_arg}`,
        "-y",
      ],
      { stdio: "inherit" }
    );
    const tid = setInterval(() => {
      int++;
    }, 1000);
    ffmpeg.stdout.on("data", (data) => {
      console.log(`stdout: ${data}`);
    });

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
        console.log(`${(isNaN(percentage) ? 100.0 : percentage).toFixed(2)}% complete`);
      } else {
        console.error(`stderr: ${data}`);
      }
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

     
    });
  } catch (err) {
    console.error("ERROR COMPRESSING FILE: ", err);
    process.exit(1);
  }
}

async function convertToM3U8(file: string) {
  try {
    console.log('converting to m3u8 -> ', file)
    const originalSize = (await findSize(file)).size;
     const ffmpeg = spawn("ffmpeg", [
      "-i",
      `${file}`,
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
      `hls/${file.split(".")[0]}.m3u8`
     ],{ stdio: ["inherit", "pipe", "pipe"] })
     let int = 0;
     const tid = setInterval(() => {
      int++;
    }, 1000);

    ffmpeg.stdout.on("data", (data) => {
      console.log(`stdout: ${data}`);
    });

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
        console.log(`${(isNaN(percentage) ? 100.0 : percentage).toFixed(2)}% complete`);
      } else {
        console.error(`stderr: ${data}`);
      }
    });

    ffmpeg.on("close", async (code) => {
      clearInterval(tid);
      console.log("Elapsed time", int >= 60 ? int / 60 + "m" : int + "s");
      console.log(`Child process exited with code ${code}`);
    });
  } catch (err) {
    console.error("ERROR CONVERTING TO M3U8: ", err);
    process.exit(1);
  }
}


async function main() {
  try {
    const last_arg = process.argv.at(-1);
    //  await runScript(last_arg);
    await convertToM3U8("compressed_" + last_arg);
  } catch (err) {
    console.error("Uncaught error", err);
  }
}

main();