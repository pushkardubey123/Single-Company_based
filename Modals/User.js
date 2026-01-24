const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
      companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    role: {
      type: String,
      enum: ["admin", "employee"],
      required: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    phone: {
      type: String,
    },

    passwordHash: {
      type: String,
      required: true,
    },

    gender: {
      type: String,
    },

    dob: {
      type: Date,
    },

    address: {
      type: String,
    },

    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
    },

    designationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Designation",
    },

    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
    },

    shiftId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shift",
    },

    doj: {
      type: Date,
    },

    status: {
      type: String,
      enum: ["active", "inactive", "resigned"],
      default: "active",
    },

    documents: [
      {
        type: String,
      },
    ],

    profilePic: {
      type: String,
    },

    basicSalary: {
      type: Number,
      default: 0,
    },

    pan: {
      type: String,
    },

    bankAccount: {
      type: String,
    },

    emergencyContact: {
      name: {
        type: String,
      },
      phone: {
        type: String,
      },
      relation: {
        type: String,
      },
    },

    otp: {
      type: String,
    },

    otpExpires: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

const userTbl = mongoose.model("User", UserSchema);
module.exports = userTbl;
