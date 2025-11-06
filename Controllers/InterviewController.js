const Interview = require("../Modals/Interview");
const Application = require("../Modals/Application");
const calendar = require("../utils/googleConfig");
const nodemailer = require("nodemailer");
const moment = require("moment");

exports.scheduleInterview = async (req, res) => {
  try {
    const {
      applicationId,
      title,
      description,
      date,
      startTime,
      endTime,
      mode,
      location,
    } = req.body;
    const createdBy = req.user._id;

    const application = await Application.findById(applicationId).populate(
      "jobId"
    );
    if (!application)
      return res.status(404).json({ message: "Application not found" });

    const candidateEmail = application.email;
    const candidateName = application.name;

    const startDateTime = moment(
      `${date} ${startTime}`,
      "YYYY-MM-DD HH:mm"
    ).toISOString();
    const endDateTime = moment(
      `${date} ${endTime}`,
      "YYYY-MM-DD HH:mm"
    ).toISOString();

    const event = {
      summary: title,
      description,
      start: { dateTime: startDateTime, timeZone: "Asia/Kolkata" },
      end: { dateTime: endDateTime, timeZone: "Asia/Kolkata" },
      attendees: [{ email: candidateEmail }],
      conferenceData: {
        createRequest: { requestId: `interview-${Date.now()}` },
      },
    };

    const response = await calendar.events.insert({
      calendarId: "primary",
      resource: event,
      conferenceDataVersion: 1,
    });

    const googleMeetLink = response.data.hangoutLink;
    const calendarEventId = response.data.id;

    const interview = new Interview({
      applicationId,
      jobId: application.jobId._id,
      candidateEmail,
      candidateName,
      title,
      description,
      date,
      startTime,
      endTime,
      mode,
      location,
      createdBy,
      googleMeetLink,
      calendarEventId,
    });

    await interview.save();

    application.status = "interview_scheduled";
    await application.save();

    sendEmail(
      candidateEmail,
      title,
      description,
      startDateTime,
      endDateTime,
      googleMeetLink
    );

    res
      .status(201)
      .json({
        success: true,
        message: "Interview scheduled successfully",
        interview,
      });
  } catch (error) {
    console.error("Error scheduling interview:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const sendEmail = (to, title, description, start, end, meetLink) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });

  const mailOptions = {
    from: '"HRMS Interview" <your_email@gmail.com>',
    to,
    subject: `Interview Scheduled: ${title}`,
    html: `
      <p>Hello,</p>
      <p>Your interview has been scheduled:</p>
      <ul>
        <li><strong>Title:</strong> ${title}</li>
        <li><strong>Description:</strong> ${description}</li>
        <li><strong>Start:</strong> ${moment(start).format("LLLL")}</li>
        <li><strong>End:</strong> ${moment(end).format("LLLL")}</li>
      </ul>
      <p><strong>Google Meet Link:</strong> <a href="${meetLink}">${meetLink}</a></p>
    `,
  };

  transporter.sendMail(mailOptions, (err) => {
    if (err) console.error("Email Error:", err);
  });
};

exports.getAllInterviews = async (req, res) => {
  try {
    const interviews = await Interview.find().populate(
      "applicationId jobId createdBy"
    );
    res.status(200).json({ success: true, interviews });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Error fetching interviews", error });
  }
};

exports.getInterviewById = async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id).populate(
      "applicationId jobId createdBy"
    );
    if (!interview)
      return res
        .status(404)
        .json({ success: false, message: "Interview not found" });
    res.status(200).json({ success: true, interview });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Error fetching interview", error });
  }
};

exports.updateInterview = async (req, res) => {
  try {
    const { title, description, date, startTime, endTime, mode, location } =
      req.body;

    const interview = await Interview.findById(req.params.id);
    if (!interview)
      return res
        .status(404)
        .json({ success: false, message: "Interview not found" });
    if (interview.calendarEventId) {
      const startDateTime = moment(
        `${date} ${startTime}`,
        "YYYY-MM-DD HH:mm"
      ).toISOString();
      const endDateTime = moment(
        `${date} ${endTime}`,
        "YYYY-MM-DD HH:mm"
      ).toISOString();

      await calendar.events.update({
        calendarId: "primary",
        eventId: interview.calendarEventId,
        resource: {
          summary: title,
          description,
          start: { dateTime: startDateTime, timeZone: "Asia/Kolkata" },
          end: { dateTime: endDateTime, timeZone: "Asia/Kolkata" },
          attendees: [{ email: interview.candidateEmail }],
        },
      });
    }

    interview.title = title || interview.title;
    interview.description = description || interview.description;
    interview.date = date || interview.date;
    interview.startTime = startTime || interview.startTime;
    interview.endTime = endTime || interview.endTime;
    interview.mode = mode || interview.mode;
    interview.location = location || interview.location;

    await interview.save();
    res
      .status(200)
      .json({
        success: true,
        message: "Interview updated successfully",
        interview,
      });
  } catch (error) {
    console.error("Error updating interview:", error);
    res
      .status(500)
      .json({ success: false, message: "Error updating interview", error });
  }
};

exports.deleteInterview = async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id);
    if (!interview)
      return res
        .status(404)
        .json({ success: false, message: "Interview not found" });

    if (interview.calendarEventId) {
      await calendar.events.delete({
        calendarId: "primary",
        eventId: interview.calendarEventId,
      });
    }

    await interview.deleteOne();

    await Application.findByIdAndUpdate(interview.applicationId, {
      status: "shortlisted",
    });

    res
      .status(200)
      .json({ success: true, message: "Interview deleted successfully" });
  } catch (error) {
    console.error("Error deleting interview:", error);
    res
      .status(500)
      .json({ success: false, message: "Error deleting interview", error });
  }
};
