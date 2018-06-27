'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
const faker = require('faker');
const mongoose = require('mongoose');

// this makes the expect syntax available throughout
// this module
const expect = chai.expect;

const {BlogPost} = require('../models');
const {app, runServer, closeServer} = require('../server');
const {TEST_DATABASE_URL} = require('../config');

chai.use(chaiHttp);

// used to put randomish documents in db
// so we have data to work with and assert about.
// we use the Faker library to automatically
// generate placeholder values for author, title, content
// and then we insert that data into mongo
function seedBlogData() {
  console.info('seeding blog data');
  const seedData = [];

  for (let i=1; i<=10; i++) {
    seedData.push(generateBlogData());
  }
  // this will return a promise
  return BlogPost.insertMany(seedData);
}


// generate an object represnting a restaurant.
// can be used to generate seed data for db
// or request.body data
function generateBlogData() {
  return {
    title: faker.company.companyName(),
    author: {
      "firstName" : faker.name.firstName(), 
      "lastName" : faker.name.lastName()
    },
    content: faker.lorem.paragraph(),
  };
}


// this function deletes the entire database.
// we'll call it in an `afterEach` block below
// to ensure data from one test does not stick
// around for next one
function tearDownDb() {
  console.warn('Deleting database');
  return mongoose.connection.dropDatabase();
}

describe('BlogPosts API resource', function() {
  before(function() {
    return runServer(TEST_DATABASE_URL);
  });

  beforeEach(function() {
    return seedBlogData();
  });

  afterEach(function() {
    return tearDownDb();
  });

  after(function() {
    return closeServer();
  });

  describe('GET endpoint', function() {

    it('should return all existing blogposts', function() {
      let res;
      return chai.request(app)
        .get('/posts')
        .then(function(_res) {
          // so subsequent .then blocks can access response object
          res = _res;
          expect(res).to.have.status(200);
          
          // otherwise our db seeding didn't work
          expect(res.body).to.have.lengthOf.at.least(1);
          console.log(BlogPost.count());
          return BlogPost.count();
        })
        .then(function(count) {
        expect(res.body).to.have.lengthOf(count);
        });
    });


    it('should return blogposts with right fields', function() {
      let resBlogPost;
      return chai.request(app)
        .get('/posts')
        .then(function(res) {
          expect(res).to.have.status(200);
          expect(res).to.be.json;
          expect(res.body).to.be.a('array');
          expect(res.body).to.have.lengthOf.at.least(1);

         res.body.forEach(function(blogpost) {
            expect(blogpost).to.be.a('object');
            expect(blogpost).to.include.keys(
              'id', 'title','author', 'content');
          });
          resBlogPost = res.body[0];
          return BlogPost.findById(resBlogPost.id);
        })
        .then(function(blogpost) {

          expect(resBlogPost.id).to.equal(blogpost.id);
          expect(resBlogPost.title).to.equal(blogpost.title);
          expect(resBlogPost.author).to.equal(blogpost.authorName);
          expect(resBlogPost.content).to.equal(blogpost.content);
          
        });
    });
  });

  describe('POST endpoint', function() {
    // strategy: make a POST request with data,
    // then prove that the restaurant we get back has
    // right keys, and that `id` is there (which means
    // the data was inserted into db)
    it('should add a new restaurant', function() {

      const newBlogPost = generateBlogData();


      return chai.request(app)
        .post('/posts')
        .send(newBlogPost)
        .then(function(res) {
          expect(res).to.have.status(201);
          expect(res).to.be.json;
          expect(res.body).to.be.a('object');
          expect(res.body).to.include.keys(
            'id', 'title', 'author', 'content');
          expect(res.body.title).to.equal(newBlogPost.title);
          // cause Mongo should have created id on insertion
          expect(res.body.id).to.not.be.null;
          expect(res.body.content).to.equal(newBlogPost.content);
          //expect(res.body.author).to.equal(newRestaurant.authorName);
          return BlogPost.findById(res.body.id);
        })
        .then(function(blogpost) {
          expect(blogpost.title).to.equal(newBlogPost.title);
          expect(blogpost.content).to.equal(newBlogPost.content);
          expect(blogpost.author.firstName).to.equal(newBlogPost.author.firstName);
          expect(blogpost.author.lastName).to.equal(newBlogPost.author.lastName);
        });
    });
  });

  describe('PUT endpoint', function() {

    // strategy:
    //  1. Get an existing restaurant from db
    //  2. Make a PUT request to update that restaurant
    //  3. Prove restaurant returned by request contains data we sent
    //  4. Prove restaurant in db is correctly updated
    it('should update fields you send over', function() {
      const updateData = {
        title: 'fofofofofofofof',
        content: 'lolololololololololololol'
      };

      return BlogPost
        .findOne()
        .then(function(blogpost) {
          updateData.id = blogpost.id;

          // make request then inspect it to make sure it reflects
          // data we sent
          return chai.request(app)
            .put(`/posts/${blogpost.id}`)
            .send(updateData);
        })
        .then(function(res) {
          expect(res).to.have.status(204);

          return BlogPost.findById(updateData.id);
        })
        .then(function(blogpost) {
          expect(blogpost.title).to.equal(updateData.title);
          expect(blogpost.content).to.equal(updateData.content);
        });
    });
  });

  describe('DELETE endpoint', function() {
    // strategy:
    //  1. get a restaurant
    //  2. make a DELETE request for that restaurant's id
    //  3. assert that response has right status code
    //  4. prove that restaurant with the id doesn't exist in db anymore
    it('delete a blogpost by id', function() {

      let blogpost;

      return BlogPost
        .findOne()
        .then(function(_blogpost) {
          blogpost = _blogpost;
          return chai.request(app).delete(`/posts/${blogpost.id}`);
        })
        .then(function(res) {
          expect(res).to.have.status(204);
          return BlogPost.findById(blogpost.id);
        })
        .then(function(_blogpost) {
          expect(_blogpost).to.be.null;
        });
    });
  });
});
