const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");

const verifyFaceUsingPython = async (storedImagePath, liveImageBase64) => {
  const form = new FormData();

  // Convert live base64 to buffer
  const liveBuffer = Buffer.from(
    liveImageBase64.replace(/^data:image\/\w+;base64,/, ""),
    "base64"
  );

  form.append("stored_image", fs.createReadStream(storedImagePath));
  form.append("live_image", liveBuffer, {
    filename: "live.jpg",
    contentType: "image/jpeg",
  });

  const response = await axios.post(
    "http://127.0.0.1:8000/verify-face",
    form,
    { headers: form.getHeaders() }
  );

  return response.data;
};

module.exports = verifyFaceUsingPython;
