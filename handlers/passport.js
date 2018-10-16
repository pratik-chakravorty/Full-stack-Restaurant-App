const passport = require("passport");
const mongoose = require("mongoose");
const User = mongoose.model("User");

passport.use(User.createStrategy()); //we can do that because we used that plugin in the User model.
//once we login what info is needed in each request
passport.serializeUser(User.serializeUser()); //Gives a user object for each request so we can do stuff based on that user.
passport.deserializeUser(User.deserializeUser());
