import { spawn } from "child_process";

function executeScript(inputFile: string) {
  try {
    let int = 0;
    const iid = setInterval(() => {
      int++;
    }, 1000);
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
        "tmp/high_%03d.ts",
        "tmp/high.m3u8",
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
    ffmpeg.on("close", (data) => {
      clearInterval(iid);
      const minutes = Math.floor(int / 60);
      const seconds = int - minutes * 60;
      console.log("elapsed time: ", int + " second(s)");
      console.log("elapsed time: ", minutes + " min " + seconds + " second(s)");
      console.log("Process closed with no error: ", data);
    });
  } catch (err) {
    console.error(err);
    return err;
  }
}

executeScript(process.argv.at(-1));
