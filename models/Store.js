//we need mongoose to interact with the mongodb database
const mongoose = require("mongoose");
/*we need to tell mongoose to use the global promise. Setting it to global promise allows
us to use async await because the default mongoose works using callbacks for async stuff*/
mongoose.Promise = global.Promise;
//allow us to make url-friendly names
const slug = require("slugs");

const striptags = require("striptags");

//schema will describe what our data looks like
const storeSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true, //removes extra whitepsaces
    required: "Please enter a store name!" //this will evaluate to true and if false will show this message
    //if we would have simply set required to true it would have given a weird mongodb error
  },
  slug: String,
  description: {
    type: String,
    trim: true
  },
  tags: [String],
  created: {
    type: Date,
    default: Date.now
  },
  location: {
    type: {
      type: String,
      default: "Point"
    },
    coordinates: [
      {
        type: Number,
        required: "You must supply coordinates"
      }
    ],
    address: {
      type: String,
      required: "You must supply an address"
    }
  },
  photo: String,
  author: {
    type: mongoose.Schema.ObjectId,
    ref: "User", //author should be in reference to the User Model
    required: "You must supply an author"
  }
});

//define our indexes
storeSchema.index({
  name: "text",
  description: "text"
});

//define our location as geospatial so it can find the stuff nearby when we pass lat and lng
storeSchema.index({
  location: "2dsphere"
});

//remove tags
storeSchema.pre("save", async function(next) {
  if (!this.isModified("name")) {
    next();
    return;
  }
  this.name = striptags(this.name, null, "Default Store");
  next();
});

//we can use a pre-save hook to auto-generate the slug before saving the data
storeSchema.pre("save", async function(next) {
  if (!this.isModified("name")) {
    next(); // skip it
    return; //stop this function from running
  }
  this.slug = slug(this.name);
  //find other stores that have slug example- something, something-1,something-2
  const slugRegEx = new RegExp(`^(${this.slug})((-[0-9]*$)?)$`, "i"); //^-starts with | $-ends  with | [0-9] any number | *-however many | ?-optional
  const storesWithSlug = await this.constructor.find({ slug: slugRegEx }); //this.constructor allows you to access the store model before saving
  if (storesWithSlug.length) {
    //if something exist change the slug to something-1 etc..
    this.slug = `${this.slug}-${storesWithSlug.length + 1}`;
  }
  next();
});

//define our custom static methods
storeSchema.statics.getTagsList = function() {
  //we need to use this and this will be bound to our model
  //$unwind aggregate operator will unwind each store meaning say we have a store with 5 tags it will create five seperate objects of that same store with each of the 5 tags
  return this.aggregate([
    { $unwind: "$tags" }, // with quotes and dollar sign means this is a field in my document. $unwind separates each store with its tags
    { $group: { _id: "$tags", count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
};

storeSchema.statics.getTopStores = function() {
  return this.aggregate([
    //lookup stores and populate reviews
    //basically get all the reviews for each stores.
    {
      $lookup: {
        from: "reviews",
        localField: "_id",
        foreignField: "store",
        as: "reviews"
      }
    },
    //filter for only items that have 2 reviews
    {
      $match: {
        "reviews.1": { $exists: true } //reviews.1 is how we access array indexes in mongodb
      }
    },
    //add the average reviews field
    {
      $project: {
        averageRating: { $avg: "$reviews.rating" },
        photo: "$$ROOT.photo",
        name: "$$ROOT.name",
        reviews: "$$ROOT.reviews",
        slug: "$$ROOT.slug"
      }
    }, //project-add a field
    //sort it by our new field, highest reviews first
    { $sort: { averageRating: -1 } },
    //limit to at most 10
    { $limit: 10 }
  ]);
};

//find reviews where stores id property is equal to the reviews store property
storeSchema.virtual("reviews", {
  ref: "Review", //what model to link
  localField: "_id", //which field on the store
  foreignField: "store" //which field on the review
});

function autopopulate(next) {
  this.populate("reviews");
  next();
}

storeSchema.pre("find", autopopulate);
storeSchema.pre("findOne", autopopulate);
//since schema is the main thing we export from here we use module.exports
module.exports = mongoose.model("Store", storeSchema);
