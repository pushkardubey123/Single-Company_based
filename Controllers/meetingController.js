const Meeting = require("../Modals/Meeting");
const calendar = require("../utils/googleConfig");
const userTbl = require("../Modals/User");
const nodemailer = require("nodemailer");
const moment = require("moment");

exports.createMeeting = async (req, res) => {
  try {
    const { title, description, date, startTime, endTime, participants } =
      req.body;
    const createdBy = req.user._id;

    const startDateTime = moment(
      `${date} ${startTime}`,
      "YYYY-MM-DD HH:mm"
    ).toISOString();
    const endDateTime = moment(
      `${date} ${endTime}`,
      "YYYY-MM-DD HH:mm"
    ).toISOString();

    const users = await userTbl.find({ _id: { $in: participants } });

    const event = {
      summary: title,
      description,
      start: { dateTime: startDateTime, timeZone: "Asia/Kolkata" },
      end: { dateTime: endDateTime, timeZone: "Asia/Kolkata" },
      attendees: users.map((user) => ({ email: user.email })),
      conferenceData: {
        createRequest: {
          requestId: `meet-${Date.now()}`,
        },
      },
    };

    const response = await calendar.events.insert({
      calendarId: "primary",
      resource: event,
      conferenceDataVersion: 1,
    });

    const googleMeetLink = response.data.hangoutLink;
    const calendarEventId = response.data.id;

    const meeting = new Meeting({
      title,
      description,
      date,
      startTime,
      endTime,
      createdBy: req.user.id,
      participants,
      googleMeetLink,
      calendarEventId,
    });

    await meeting.save();

    users.forEach((user) => {
      sendEmail(
        user.email,
        title,
        description,
        startDateTime,
        endDateTime,
        googleMeetLink
      );
    });

    res
      .status(201)
      .json({
        success: true,
        message: "Meeting created successfully",
        meeting,
      });
  } catch (error) {
    console.error("Error creating meeting:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const sendEmail = (to, title, description, start, end, meetLink) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: '"HRMS Meeting" <your_email@gmail.com>',
    to,
    subject: `Meeting Invite: ${title}`,
    html: `
      <p>Hello,</p>
      <p>You have been invited to the following meeting:</p>
      <ul>
        <li><strong>Title:</strong> ${title}</li>
        <li><strong>Description:</strong> ${description}</li>
        <li><strong>Start:</strong> ${moment(start).format("LLLL")}</li>
        <li><strong>End:</strong> ${moment(end).format("LLLL")}</li>
      </ul>
      <p><strong>Google Meet Link:</strong> <a href="${meetLink}">${meetLink}</a></p>
    `,
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) console.error("Email Error:", err);
  });
};

exports.getAllMeetings = async (req, res) => {
  try {
    const meetings = await Meeting.find()
      .populate("createdBy", "name email")
      .populate("participants", "name email");
    res.status(200).json(meetings);
  } catch (error) {
    res.status(500).json({ message: "Error fetching meetings", error });
  }
};

exports.updateMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });

    const { title, description, date, startTime, endTime, participants } =
      req.body;

    const startDateTime = moment(
      `${date} ${startTime}`,
      "YYYY-MM-DD HH:mm"
    ).toISOString();
    const endDateTime = moment(
      `${date} ${endTime}`,
      "YYYY-MM-DD HH:mm"
    ).toISOString();

    if (meeting.calendarEventId) {
      await calendar.events.update({
        calendarId: "primary",
        eventId: meeting.calendarEventId,
        requestBody: {
          summary: title,
          description,
          start: { dateTime: startDateTime, timeZone: "Asia/Kolkata" },
          end: { dateTime: endDateTime, timeZone: "Asia/Kolkata" },
        },
      });
    }

    const updated = await Meeting.findByIdAndUpdate(
      req.params.id,
      { title, description, date, startTime, endTime, participants },
      { new: true }
    );

    res
      .status(200)
      .json({ message: "Meeting updated in DB & Google Calendar", updated });
  } catch (error) {
    console.error("Error updating meeting:", error);
    res
      .status(500)
      .json({ message: "Error updating meeting", error: error.message });
  }
};

exports.deleteMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });

    if (meeting.calendarEventId) {
      await calendar.events.delete({
        calendarId: "primary",
        eventId: meeting.calendarEventId,
      });
    }

    await Meeting.findByIdAndDelete(req.params.id);

    res
      .status(200)
      .json({ message: "Meeting deleted from DB & Google Calendar" });
  } catch (error) {
    console.error("Error deleting meeting:", error);
    res
      .status(500)
      .json({ message: "Error deleting meeting", error: error.message });
  }
};
