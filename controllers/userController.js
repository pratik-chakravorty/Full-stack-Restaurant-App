const mongoose = require("mongoose");
const User = mongoose.model("User");

const promisify = require("es6-promisify");

exports.loginForm = (req, res) => {
  if (req.user) {
    res.redirect("back");
  }
  res.render("login", { title: "Login" });
};

exports.registerForm = (req, res) => {
  if (req.user) {
    res.redirect("back");
  }
  res.render("register", { title: "Register" });
};

exports.validateRegister = (req, res, next) => {
  //sanitize the name->stop them from adding script tags
  //express-validator is used here which applies a bunch of validation methods in the req obj
  req.sanitizeBody("name");
  req.checkBody("name", "You must supply a name!").notEmpty();
  req.checkBody("email", "That email is not valid").isEmail();
  req.sanitizeBody("email").normalizeEmail({
    remove_dots: false,
    remove_extension: false,
    gmail_remove_subaddress: false
  });
  req.checkBody("password", "Password cannot be blank").notEmpty();
  req
    .checkBody("password-confirm", "Confirmed Password cannot be blank")
    .notEmpty();
  req
    .checkBody("password-confirm", "Oops! your passwords do not match")
    .equals(req.body.password);

  //getting the errors
  const errors = req.validationErrors();
  if (errors) {
    req.flash("error", errors.map(err => err.msg));
    //we need to pass the whole body to populate the fields and pass the flashes as well for
    //giving the required error messages.
    res.render("register", {
      title: "Register",
      body: req.body,
      flashes: req.flash()
    });
    return; //stop the function from running
  }
  next(); //call the next middleware
};

exports.register = async (req, res, next) => {
  const user = new User({ email: req.body.email, name: req.body.name });
  //passportlocalmongoose will expose us a method called register which will hash the password and save the data in db
  //promisify changes an old callback based function into a promise based function so that we can use async await
  const register = promisify(User.register, User); //User.register is a function so the second parameter tells where the this should be bound
  await register(user, req.body.password);
  next(); //pass to authController.login
};

exports.account = (req, res) => {
  res.render("account", { title: "Edit your account" });
};

exports.updateAccount = async (req, res) => {
  const updates = {
    name: req.body.name,
    email: req.body.email
  };

  const user = await User.findOneAndUpdate(
    { _id: req.user._id },
    { $set: updates },
    { new: true, runValidators: true, context: "query" }
  );
  req.flash("success", "Updated the profile");
  res.redirect("back");
};
