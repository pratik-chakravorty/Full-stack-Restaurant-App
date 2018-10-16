const mongoose = require("mongoose");
const Store = mongoose.model("Store"); //mongoose uses a singleton concept where once it is imported
//it uses the same instance throughout the application
const User = mongoose.model("User");
const multer = require("multer"); //handles image uploading-make sure form has an enctype
//striptags
const striptags = require("striptags");
//resize our photos
const jimp = require("jimp");

//make photo filenames unique
const uuid = require("uuid");
//options needed for multer to work
const multerOptions = {
  //we need two things. Where will the file be stored and what types of files are allowed
  storage: multer.memoryStorage(), //we will read the original image in memory resize it and store the resize version
  fileFilter(req, file, next) {
    const isPhoto = file.mimetype.startsWith("image/");
    if (isPhoto) {
      next(null, true); //if next('something') -> error | next(null,'some value') -> no error second value is passed along
    } else {
      next({ message: "That filetype isn't allowed" }, false);
    }
  }
};

exports.homePage = (req, res) => {
  res.render("index");
};

//shows the add store page with the form.
exports.addStore = (req, res) => {
  res.render("editStore", { title: "Add Store" });
};

exports.upload = multer(multerOptions).single("photo"); //use a single field called photo

//saving the image record the filename and passing it to createstore
exports.resize = async (req, res, next) => {
  // check if there is no new file to resize
  if (!req.file) {
    //multer will put the file property into the req object
    next(); //skip to the next middleware
    return;
  }
  console.log(req.file);
  const extension = req.file.mimetype.split("/")[1]; // split("image/jpeg") gives ["image","jpeg"] -> get the second thing
  //set it up so the createStore has the info
  req.body.photo = `${uuid.v4()}.${extension}`; //the filename for the photo will be created

  //resizing
  const photo = await jimp.read(req.file.buffer); //jimp is based on promises so we can await the result
  await photo.resize(800, jimp.AUTO); //resizing the photo - check docs for more info
  await photo.write(`./public/uploads/${req.body.photo}`);

  //once we have written the photo to our filesystem keep going
  next();
};

//used for creating a store and saving it into the database
exports.createStore = async (req, res) => {
  req.body.author = req.user._id; //take the id of the currently logged in user and put it in req.body.author
  //saving the store data
  const store = await new Store(req.body).save(); //we do this to get the slug value
  req.flash(
    "success",
    `Successfully Created ${store.name}. Care to leave a review. `
  );
  res.redirect(`/store/${store.slug}`);
};

//retrieves all the stores from the database
exports.getStores = async (req, res) => {
  const page = req.params.page || 1;
  const limit = 4;
  const skip = page * limit - limit;
  //1. query the database for a list of all stores
  const storesPromise = Store.find()
    .skip(skip)
    .limit(limit)
    .sort({ created: "desc" });
  const countPromise = Store.count();
  const [stores, count] = await Promise.all([storesPromise, countPromise]);

  const pages = Math.ceil(count / limit);
  if (!stores.length && skip) {
    req.flash(
      "info",
      `Hey you asked for ${page}. But that doesn't exist. So I put you on page ${pages}`
    );
    res.redirect(`/stores/page/${pages}`);
    return;
  }
  res.render("stores", { title: "Stores", stores, page, pages, count });
};

const confirmOwner = (store, user) => {
  if (!store.author.equals(user._id)) {
    throw Error("You must own the store to edit it!");
  }
};

exports.editStore = async (req, res) => {
  //1. find the store given the id
  const store = await Store.findOne({ _id: req.params.id });
  //2. confirm they are the owner of the store -- wait for now
  confirmOwner(store, req.user);
  //3. Render out the edit form so the user can update the store.
  res.render("editStore", { title: `Edit ${store.name}`, store });
};

exports.updateStore = async (req, res) => {
  //set the location data to be a point
  req.body.location.type = "Point";

  //strip tags
  req.body.name = striptags(req.body.name, null, "Default Store");
  //1. find and update the store
  //.findOneUpdate(query,data,options)
  const store = await Store.findOneAndUpdate({ _id: req.params.id }, req.body, {
    new: true, // return the new store of instead of the old one -- default it returns the old store not the updated data
    runValidators: true //run the required validator parts
  }).exec();
  req.flash(
    "success",
    `Successfully <strong>${store.name}</strong>. 
  <a href="/stores/${store.slug}">View Store</a>`
  );
  //2. redirect them to the store and tell them it worked
  res.redirect(`/stores/${store._id}/edit`);
};

exports.getStoreBySlug = async (req, res, next) => {
  const store = await Store.findOne({ slug: req.params.slug }).populate(
    "author reviews"
  ); //populate will go and find the actual document and get the data for that specific id
  if (!store) return next();
  res.render("store", { store, title: store.name });
};

exports.getStoresByTag = async (req, res) => {
  const tag = req.params.tag;
  const tagQuery = tag || { $exists: true }; //give any store that has tag property on it
  const tagsPromise = Store.getTagsList(); //we can have static methods in our store model
  const storesPromise = Store.find({ tags: tagQuery });
  const [tags, stores] = await Promise.all([tagsPromise, storesPromise]);
  res.render("tag", { tags, title: "Tags", tag, stores });
};

exports.searchStores = async (req, res) => {
  const stores = await Store
    //find the stores
    .find(
      {
        $text: {
          $search: req.query.q
        }
      },
      {
        //project -meaning add a field
        score: { $meta: "textScore" }
      }
    )
    //sort them
    .sort({
      score: { $meta: "textScore" }
    })
    //limit to 5 results
    .limit(5);
  res.json(stores);
};

exports.mapStores = async (req, res) => {
  const coordinates = [req.query.lng, req.query.lat].map(parseFloat);
  const q = {
    location: {
      $near: {
        //near is a operator in mongodb that allows you to search stuff near a certain lat and lng
        $geometry: {
          type: "Point",
          coordinates
        },
        $maxDistance: 10000 //10,000 meters
      }
    }
  };

  const stores = await Store.find(q)
    .select("slug name description location photo")
    .limit(10); //select-we can specifiy which fields we want
  res.json(stores);
};

exports.mapPage = (req, res) => {
  res.render("map", { title: "Map" });
};

exports.heartStore = async (req, res) => {
  //we need a toggle system where posting to this route if they have the store already will remove it
  //or it will add the store
  const hearts = req.user.hearts.map(obj => obj.toString()); //by default it is in a ObjectId format
  const operator = hearts.includes(req.params.id) ? "$pull" : "$addToSet"; //check if the store id is in the array if yes remove it else add it
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { [operator]: { hearts: req.params.id } }, //[operator] will be either $pull or $addToSet depending on the condition
    { new: true }
  );
  res.json(user);
};

exports.hearts = async (req, res) => {
  //Two Ways to do this
  //Method-1
  // const stores = await User.find({ _id: req.user._id }).populate("hearts");
  //Method-2
  const stores = await Store.find({
    _id: { $in: req.user.hearts }
  });
  res.render("heartedStores", { title: "Hearted Stores", stores });
};

exports.getTopStores = async (req, res) => {
  const stores = await Store.getTopStores();
  res.render("topStores", { stores, title: "Top Stores" });
};
