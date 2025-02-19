// Configuration for different quality levels
const QUALITY_PROFILES = [
  {
    name: "low",
    height: 480,
    bitrate: "800k",
    audioBitrate: "64k",
  },
  {
    name: "medium",
    height: 720,
    bitrate: "2500k",
    audioBitrate: "128k",
  },
  {
    name: "high",
    height: 1080,
    bitrate: "5000k",
    audioBitrate: "192k",
  },
];

// Function to generate FFmpeg command for adaptive bitrate streaming
function generateHLSCommand(inputPath: string, outputPath: string): string {
  const variantStreams = QUALITY_PROFILES.map((profile) => {
    return [
      `-c:v libx264`,
      `-preset veryfast`, // Faster encoding, slight quality trade-off
      `-b:v ${profile.bitrate}`,
      `-maxrate ${profile.bitrate}`,
      `-bufsize ${parseInt(profile.bitrate) * 2}k`,
      `-c:a aac`,
      `-b:a ${profile.audioBitrate}`,
      `-hls_segment_filename ${outputPath}/${profile.name}_%03d.ts`,
      `${outputPath}/${profile.name}.m3u8`,
    ].join(" ");
  });

  return [
    "ffmpeg",
    "-i",
    inputPath,
    "-profile:v baseline", // Better device compatibility
    "-level 3.0",
    "-start_number 0",
    "-hls_time 6", // 6-second segments
    "-hls_list_size 0",
    "-f hls",
    variantStreams.join(" "),
  ].join(" ");
}

// Function to create master playlist
function generateMasterPlaylist(baseUrl: string): string {
  return QUALITY_PROFILES.map((profile) => {
    return [
      "#EXT-X-STREAM-INF:",
      `BANDWIDTH=${parseInt(profile.bitrate) * 1000},`,
      `RESOLUTION=${profile.height}p,`,
      `NAME="${profile.name}"`,
      `${baseUrl}/${profile.name}.m3u8`,
    ].join("");
  }).join("\n");
}

const res = generateHLSCommand("WDS_1990_BIS.mp4", "tmp");
console.log(res);

//   const watcher = chokidar.watch(`${tempDir}/*.ts`, { persistent: true });

// watcher.on('add', async (filePath) => {
//     console.log(`New segment detected: ${filePath}`);

//     // Extract filename (e.g., "segment0.ts")
//     const fileName = path.basename(filePath);
//     const destination = `hls/${fileName}`; // GCS path

//     try {
//         // Upload to GCS
//         await storage.bucket(bucketName).upload(filePath, {
//             destination: destination,
//             contentType: 'video/mp2t'
//         });

//         console.log(`Uploaded ${fileName} to GCS`);

//         // Delete file after upload to save space
//         fs.unlink(filePath, (err) => {
//             if (err) console.error(`Error deleting ${filePath}:`, err);
//             else console.log(`Deleted ${fileName} from local storage`);
//         });

//         // Update .m3u8 manifest to replace local reference with GCS URL
//         updateManifest(outputManifest, fileName, `https://storage.googleapis.com/${bucketName}/${destination}`);
//     } catch (err) {
//         console.error(`Error uploading ${fileName}:`, err);
//     }
// });

/*
FINAL COMMAND I AM CHOOSING

ffmpeg 
-i WDS_1990_BIS.mp4 
-profile:v baseline 
-level 3.0 
-start_number 0 
-hls_time 6 
-hls_list_size 0 
-f hls 
-c:v libx264 
-preset veryfast 
-b:v 5000k 
-maxrate 5000k 
-bufsize 10000k 
-c:a aac 
-b:a 64k 
-hls_segment_filename 
tmp/high_%03d.ts tmp/high.m3u8

*/
