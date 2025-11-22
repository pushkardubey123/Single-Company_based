const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");

const verifyFaceUsingPython = async (storedImagePath, liveImageBase64) => {
  const form = new FormData();

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
    "https://facerepodetection-production.up.railway.app/verify-face",
    form,
    { headers: form.getHeaders() }
  );

  return response.data;
};

module.exports = verifyFaceUsingPython;
