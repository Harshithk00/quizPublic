import express from 'express';
import bodyParser from 'body-parser';
import bcrypt from 'bcrypt';
import passport from "passport";
import pg from "pg";
import path from "path";
import { dirname } from "path";
import flash from "connect-flash"
import env from "dotenv";
import createMemoryStore from "memorystore";
import { fileURLToPath } from 'url';
import {Strategy} from "passport-local";
import session from "express-session";
import {questionset1, questionset2, questionset1written, questionset2written} from "./questionset.js";



const MemoryStore = createMemoryStore(session);

env.config();

const saltRounds=10;
const app = express();

app.use(session({
  secret: process.env.SESSIONSEC,
  resave: false,
  saveUninitialized: true,
  cookie: {maxAge: 86400000},
  store: new MemoryStore({
    checkPeriod: 86400000 // prune expired entries every 24h
  }),
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const __dirname = dirname(fileURLToPath(import.meta.url));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));

app.use(flash());

const db = new pg.Client({
  user: process.env.USER,
  password: process.env.DBPASSWORD,
  host: process.env.HOST,
  port: process.env.DBPORT,
  database: process.env.DATABASE,
  ssl: {
    require: true,
    rejectUnauthorized: false,
    ca: process.env.SSLca,
},
});

db.connect();

function zeroPad(num) {
  return num.toString().padStart(3, "0");
}


app.get('/', (req, res) => {
  if(req.isAuthenticated()) {
    res.redirect('/dashboard')
  }else {
    res.redirect("/login");
  }
});

app.get('/signup', (req, res) => {
  res.render('signup');
});

app.get('/login', (req, res) => {
  res.render('login');
});



app.get('/forgot-password', (req, res) => {
  res.render('forgot-password');
});

app.post('/api/signup', async (req, res) => {
  const { name, password, usn } = req.body;
  
  try {
    const checkResult = await db.query("SELECT * FROM users WHERE name = $1", [
      name,
    ]);

    if (checkResult.rows.length > 0) {
      res.redirect("/");
    } else {
      bcrypt.hash(password, saltRounds, async (err, hash) => {
        if (err) {
          console.error("Error hashing password:", err);
        } else {
          const result = await db.query(
            "INSERT INTO users (name, password, usn) VALUES ($1, $2, $3) RETURNING *",
            [name, hash, usn]
          );
          const user = result.rows[0];
        
            res.redirect("/");
          
        }
      });
    }
  } catch (err) {
    console.error(err);
    res.render("signup",{error:"There is something wrong. Please try again"})
  }
  
});

app.post('/api/login',
  passport.authenticate('locallogin2', {
     
    successRedirect: "/dashboard",
    failureRedirect: "/"
  }
)
);

app.get('/dashboard', async(req, res) => {
  if (req.isAuthenticated()) {
  //   if(req.cookies["context"]){
  //     let errtext1 = req.cookies["context"]
  //     res.clearCookie("context", { httpOnly: true })
  //     res.render("dashboard",{errtext1});
  // }else{
  
    res.render("dashboard",{errtext1:req.flash('errtext1')||null});
  // }
  } else {
    res.redirect("/");
  }
  // console.log(req.user.usn);
});

// app.post('/api/forgot-password', async (req, res) => {
//   const { name, phone } = req.body;
//   //logic
  

//   res.send('Password reset email sent');
// });

// app.post('/submit', (req,res)=> {
  
// })





 
app.get('/quiz', async (req, res)=> {
  
  let currentUser = req.user.usn;
  let currentUserSlice3 = currentUser.slice(-3);
  let currentUserUse = zeroPad(currentUserSlice3);
  // console.log(req.user.usn);
  
  if(req.isAuthenticated){

    

    
      
      const checkattempt = await db.query("SELECT attemptedquiz1 FROM users WHERE usn = $1",[req.user.usn])
      
      if(checkattempt.rows[0].attemptedquiz1==1){
         

        req.flash("errtext1","You have already attempted the quiz")
        res.redirect("/dashboard");}
      else{
        if(currentUserUse%2 == 0){
          res.render("question",{questions :questionset2});
        }
        else{
          res.render("question",{questions :questionset1});
        }

      }

  // Hello hii 

  }else{
    res.redirect('/');  
  }       
   
})

app.post('/quiz', async (req, res)=>{
  console.log(`USN: ${req.user.usn}`)
    if(req.isAuthenticated){
    
    const userAnswers = req.body;
    let score = 0;
    
    let currentUser = req.user.usn;
    let currentUserSlice3 = currentUser.slice(-3);
    let currentUserUse = zeroPad(currentUserSlice3);
    
    if(currentUserUse%2 == 0){
      questionset2.forEach((question, index) => {
        const userAnswer = userAnswers[`question${index}`];
        let isCorrect = userAnswer === question.answer;
        
        console.log(`Question ${index}: userAnswer = ${userAnswer}, correctAnswer = ${question.answer}, isCorrect = ${isCorrect}`);

        if (isCorrect) {
          score++;  
        }
        
      }) 
    }else{
      
      questionset1.forEach((question, index) => {
        const userAnswer = userAnswers[`question${index}`];
        
        let isCorrect = userAnswer == question.answer;
        console.log(`Question ${index}: userAnswer = ${userAnswer}, correctAnswer = ${question.answer}, isCorrect = ${isCorrect}`);
        
        if (isCorrect) {
          score++;
        }
         
      })
    }

  
    console.log(`${req.user.usn},`);
  await db.query("UPDATE users SET attemptedquiz1 = 1 WHERE usn= $1;",[req.user.usn])
  
  console.log(`${req.user.usn},`);

  console.log(`Score: ${score}`)
  await db.query("UPDATE users SET correctanswer= $1 WHERE usn= $2;",[score,req.user.usn])

  res.redirect('/quiz2')
    }else{
      res.redirect('/');
    }   

 
});


app.get("/quiz2", async(req, res)=>{

  let currentUser = req.user.usn;
  let currentUserSlice3 = currentUser.slice(-3);
  let currentUserUse = zeroPad(currentUserSlice3);
  const checkattempt = await db.query("SELECT attemptedquiz2 FROM users WHERE usn = $1",[currentUser])
  if(req.isAuthenticated){
    
    if(checkattempt == 1){
      req.flash("errtext1","Already attempted the test")
      res.redirect("/dashboard");
    }else{
    if(currentUserUse%2 == 0){
          res.render("quiz2",{questions :questionset2written});
        }
        else{
          res.render("quiz2",{questions :questionset1written});
        }
      }

  }else{
    res.redirect("/")
  }
})  

app.post('/quiz2', async (req, res)=>{

  console.log(`USN: ${req.user.usn}`)

    if(req.isAuthenticated){
        const usn = req.user.usn;
        const answers = req.body.answers;
       

        questionset2written.forEach(async(question, index) => {
          
        const answer = answers[index];
        

        try{await db.query(`UPDATE users SET writtenAnswer${index+1} = $1 WHERE usn = $2`,[answer, usn]);
        }catch(e){
          res.send(e);
        }

  });

    res.render("thankyou")
    await db.query(`UPDATE users SET attemptedquiz2 = 1 WHERE usn = $1`,[usn]);

    }else{
      res.redirect('/');
    }
 
  });

  // console.log(`${req.user. usn},`);
    // await db.query("UPDATE users SET attemptedquiz1 = 1 WHERE usn= $1;",[req.user.usn])
    
    // // console.log(`${req.user.usn},`);
  
    // console.log(`Score: ${score}`)
    // await db.query("UPDATE users SET correctanswer= $1 WHERE usn= $2;",[score,req.user.usn])
    // res.render("thankyou")
    //   }else{
    //     res.redirect('/');
    //   }


    // await db.query("UPDATE users SET writtenAnswer1 = $1 WHERE usn= $2;",[answer1,usn])

  // await db.query("UPDATE users SET writtenAnswer2 = $1 WHERE usn= $2;",[answer2,usn])

  // await db.query("UPDATE users SET writtenAnswer3 = $1 WHERE usn= $2;",[answer3,usn])

   // const answer1 = req.body.answer1;
        // const answer2 = req.body.answer2;
        // const answer3 = req.body.answer3;



app.post('/logout', (req,res) => {req.logout(function(err){
  if(err){
    return next(err);
  }
  res.redirect('/');
})})




passport.use(
  'locallogin',
  new Strategy({usernameField: "usn"},async function verify(usn, password, cb) {
    try{
      
      
      const result = await db.query("SELECT * FROM users WHERE usn = $1 ", [
        usn,
      ]);
      if (result.rows.length > 0) {
        const user = result.rows[0];
        const storedHashedPassword = user.password;
        
        bcrypt.compare(password, storedHashedPassword, (err, valid) => {
          if (err) {
            console.error("Error comparing passwords:", err);
            return cb(err);
          } else {
            if (valid) {
              return cb(null, user);
            } else {
              return cb(null, false);
            }
          }
        });
      } else {
        return cb("User not found");
      }
    } catch (err) {
      console.error(err);
      res.redirect("/");
    }
  })
);


passport.use(
  'locallogin2',
  new Strategy({usernameField: "usn"},async function verify(usn, password, cb) {
    try{
      
      
      const result = await db.query("SELECT * FROM users WHERE usn = $1 ", [
        usn,
      ]);
      if (result.rows.length > 0) {
        const user = result.rows[0];
        const storedPassword = user.password;
        const correctPass = storedPassword == password;
        
        

       const correctPassB =  bcrypt.compare(password, storedPassword) 
        // (err, valid) => {
        //   if (err) {
        //     console.error("Error comparing passwords:", err);
        //     return cb(err)
        //   } else {
        //     if (valid) {
        //       return cb(null, user)
        //     } else {
        //       return cb(null, "User not found")
        //     }
        //   }
        // });;
        
        
        if(correctPass || correctPassB){
          return cb(null, user);
        }else{
          return cb(null, false);
        }
        

        
      } else {
        return cb("User not found");
      }
    } catch (err) {
      console.error(err);
      res.redirect("/");
    }
  })
);



  passport.serializeUser((user, cb) => {
    cb(null, user);
  });
  
  passport.deserializeUser((user, cb) => {
    cb(null, user);
  });






const port = process.env.PORT;

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

