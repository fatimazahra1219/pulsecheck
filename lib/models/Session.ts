import mongoose, { Schema } from "mongoose";

const AnswerOptionSchema = new Schema(
  {
    id: {
      type: String,
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
  },
  { _id: false },
);

const ResponseSchema = new Schema(
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
    selectedOptionId: {
      type: String,
      required: false,
    },
    isCorrect: {
      type: Boolean,
      required: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const PulseSchema = new Schema(
  {
    concept: {
      type: String,
      required: true,
    },
    question: {
      type: String,
      required: true,
    },
    mode: {
      type: String,
      enum: ["rating", "knowledge_check"],
      default: "rating",
    },
    answerOptions: {
      type: [AnswerOptionSchema],
      default: [],
    },
    correctOptionId: {
      type: String,
      required: false,
    },
    explanation: {
      type: String,
      required: false,
      trim: true,
      maxlength: 1000,
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
  },
  { _id: true },
);

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
