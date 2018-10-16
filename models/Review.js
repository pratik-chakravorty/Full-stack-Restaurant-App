const mongoose = require("mongoose");

mongoose.Promise = global.Promise;

const reviewSchema = new mongoose.Schema({
  created: {
    type: Date,
    default: Date.now
  },
  author: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
    required: "You must supply an author"
  },

  store: {
    type: mongoose.Schema.ObjectId,
    ref: "Store",
    required: "You must supply a store"
  },
  text: {
    type: "String",
    required: "Your review must have a text"
  },
  rating: {
    type: Number,
    min: 1,
    max: 5
  }
});

function autopopulate(next) {
  this.populate("author");
  next();
}

//when somebody finds a review or reviews it populates the author field so that we can get the author name photo etc.
reviewSchema.pre("find", autopopulate);
reviewSchema.pre("findOne", autopopulate);

module.exports = mongoose.model("Review", reviewSchema);
