const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");

const verifyFaceUsingPython = async (storedImagePath, liveImageBase64) => {
const form = new FormData();

let base64Data = liveImageBase64;

if (base64Data.includes("base64,")) {
base64Data = base64Data.split("base64,")[1];
}

const liveBuffer = Buffer.from(base64Data, "base64");


form.append("stored_image", fs.createReadStream(storedImagePath));
form.append("live_image", liveBuffer, {
filename: "live.jpg",
contentType: "image/jpeg",
});
  

const response = await axios.post(
    "https://face-recognition-production-2ef6.up.railway.app/verify-face",
form,
{ headers: form.getHeaders() }
);

return response.data;
};

module.exports = verifyFaceUsingPython;