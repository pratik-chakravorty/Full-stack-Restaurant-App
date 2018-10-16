const passport = require("passport");
const mongoose = require("mongoose");
const User = mongoose.model("User");
const promisify = require("es6-promisify");

const crypto = require("crypto"); //built in node module for generating cryptographically secure tokens
const mail = require("../handlers/mail");
//we will make use of some middleware that comes with passport that helps us to know when
//the users have logged in correctly.

//.authenticate('what strategy to use',config obj to tell what to happen)
//local strategy allows us to use email and password

//to make this work passport needs to be configured to use local strategy.
exports.login = passport.authenticate("local", {
  failureRedirect: "/login",
  failureFlash: "Failed Login!",
  successRedirect: "/",
  successFlash: "You are now logged in!"
});

exports.logout = (req, res) => {
  req.logout();
  req.flash("success", "You are now logged out!");
  res.redirect("/");
};

exports.isLoggedIn = (req, res, next) => {
  //check if the user is authenticated
  if (req.isAuthenticated()) {
    next(); //carry on they are logged in
    return;
  }

  req.flash("error", "Oops! you must be logged in!");
  res.redirect("/login");
};

exports.forgot = async (req, res) => {
  //1. see if that user exist
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    req.flash("error", "No account with that email address exists.");
    return res.redirect("/login");
  }
  //2. set reset tokens and expiry on that account
  user.resetPasswordToken = crypto.randomBytes(20).toString("hex");
  user.resetPasswordExpires = Date.now() + 3600000; //1 hour from now.
  await user.save();
  //3. email them with the token
  const resetUrl = `http://${req.headers.host}/account/reset/${
    user.resetPasswordToken
  }`;
  await mail.send({
    user,
    filename: "password-reset",
    subject: "Password Reset",
    resetUrl
  });
  req.flash("success", `You have been emailed a password reset link.`);
  //4. redirect login page after the email token is sent
  res.redirect("/login");
};

exports.reset = async (req, res) => {
  //check if the token is valid and if it is expired
  const user = await User.findOne({
    resetPasswordToken: req.params.token,
    resetPasswordExpires: { $gt: Date.now() }
  });
  if (!user) {
    req.flash("error", "Password reset is invalid or has expired");
    res.redirect("/login");
  }
  //if there is a user show the password reset form
  res.render("reset", { title: "Reset your password" });
};

exports.confirmedPasswords = (req, res, next) => {
  if (req.body.password === req.body["password-confirm"]) {
    //access property when it has a dash
    next(); //keep it going
    return;
  }
  req.flash("error", "Passwords do not match!");
  res.redirect("back");
};

exports.update = async (req, res) => {
  const user = await User.findOne({
    resetPasswordToken: req.params.token,
    resetPasswordExpires: { $gt: Date.now() }
  });

  if (!user) {
    req.flash("error", "Password reset is invalid or has expired");
    res.redirect("/login");
  }

  const setPassword = promisify(user.setPassword, user); //user.setPassword is available because of the plugin
  await setPassword(req.body.password);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  const updatedUser = await user.save(); //saves and removes the token and the expiry now that the password has been reset
  await req.login(updatedUser); //passportjs makes login available
  req.flash("success", "Your password has been reset");
  res.redirect("/");
};
