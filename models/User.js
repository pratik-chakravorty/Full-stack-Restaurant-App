const mongoose = require("mongoose");

mongoose.Promise = global.Promise;

//used for gravatar
const md5 = require("md5");
//validation package for nodejs
const validator = require("validator");
const mongodbErrorHandler = require("mongoose-mongodb-errors");
//this will take care of adding the additional fields like passwords in our schema and adds methods needed for login
const passportLocalMongoose = require("passport-local-mongoose");

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true,
    validate: [validator.isEmail, "Invalid email address"], //we use custom validations to make sure it is an email
    required: "Please supply an email address"
  },
  name: {
    type: String,
    required: "Please supply a name",
    trim: true
  },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  hearts: [
    {
      type: mongoose.Schema.ObjectId,
      ref: "Store"
    }
  ]
});

//virtual fields are the fields that can be generated.
//whenever we need user.gravatar it generates the image link on the fly
userSchema.virtual("gravatar").get(function() {
  const hash = md5(this.email);
  return `https://gravatar.com/avatar/${hash}?s=200`;
});
//please add all the auth methods and extra stuff needed into our schema and email should be loginField
userSchema.plugin(passportLocalMongoose, { usernameField: "email" });
//change default ugly mongodb errors with codes into nice error messages.
userSchema.plugin(mongodbErrorHandler);
module.exports = mongoose.model("User", userSchema);
