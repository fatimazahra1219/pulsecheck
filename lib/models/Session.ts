import mongoose from "mongoose";

// One student's anonymous answer.
const ResponseSchema = new mongoose.Schema(
  {
    anonymousId: {
      type: String,
      required: true,
    },

    score: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false,
  },
);

// One understanding question inside a classroom session.
const PulseSchema = new mongoose.Schema({
  concept: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },

  question: {
    type: String,
    required: true,
    trim: true,
    maxlength: 300,
  },

  isActive: {
    type: Boolean,
    default: true,
  },

  isPaused: {
    type: Boolean,
    default: false,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },

  responses: {
    type: [ResponseSchema],
    default: [],
  },
});

// The entire classroom session.
const SessionSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
  },

  // Hashed private key used to authorize teacher operations.
  teacherKeyHash: {
    type: String,
    required: false,
    select: false,
  },

  topic: {
    type: String,
    default: "",
  },

  isActive: {
    type: Boolean,
    default: true,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },

  // OLD responses: preserve existing student answers.
  responses: {
    type: [ResponseSchema],
    default: [],
  },

  // NEW: multiple understanding questions per session.
  pulses: {
    type: [PulseSchema],
    default: [],
  },
});

export default mongoose.models.Session ||
  mongoose.model("Session", SessionSchema);
