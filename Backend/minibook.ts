import {Request , Response } from "express";
import express from "express";

const app = express();
app.use(express.json());

type Book = {
id : number ;
title : string ;
author : string ;
publishedYear : number ;
isAvailable : boolean;
}

const books:Book[]=[

    {
        id : 1 ,
        title : "Clean Code",
        author : "Robert",
        publishedYear: 2026,
        isAvailable : true
    },
    {
        id : 2,
        title : "Pragmatic Programmer",
        author : "Andrew Hunt ",
        publishedYear: 2026,
        isAvailable : false, 
    }
]

let nextId = 3;

app.get("/books" , (req:Request , res: Response) =>{
    res.json(books);

})

app.get("/books/:id", (req:Request,res:Response)=>{
    const reqid=Number(req.params.id);
    const reqBook= books.find((b)=> b.id === reqid);
    if(!reqBook){
         return res.status(404).json({message:"Book not found"});
    }res.json(reqBook);
});

// posting a book 

app.post("/books", (req:Request,res:Response) =>{
    const{title , author,publishedYear}= req.body // these details will be present in the body 

    if (typeof title !== "string" || typeof author !== "string" || typeof publishedYear !== "number"){
        res.status(401).json({nessage:"title and author are required strings"})
    }
    //out of the if loop
    const NewBook : Book={
        id : nextId++,
        title,
        author,
        publishedYear,
        isAvailable:true,

    }
    books.push(NewBook);
})

//updating a book 
app.put("/books/:id", (req:Request ,res : Response)=>{
    // find the id of the book 
    const reqid=Number(req.params.id);
    const reqBook=books.find((b)=>b.id === reqid);
    if(!reqBook){
         return res.status(404).json({message:"Book not found"})
    }
    // now take the new content 
    const {title,author,publishedYear,isAvailable}=req.body;

    if (
  !title ||
  !author ||
  !publishedYear ||
  isAvailable === undefined
) {
   return res.status(400).json({message:"All fields are required"});
}



    // now update the values , if there are no values make sure the code manages that 
    reqBook.author=author ;
    reqBook.title=title;
    reqBook.publishedYear=publishedYear;
    reqBook.isAvailable=isAvailable;

    return res.json(reqBook);

})

//deleting a book 

app.delete("/books/:id",(req:Request,res:Response) =>{

    //get the id
    const reqid=Number(req.params.id);
    //find the book
    const index = books.findIndex((b) => b.id ===reqid)
    //if no book
    if(index===-1){
        return res.status(404).json({message:"No book found"})
    }
    const deletedBook = books.splice(index,1)

    return res.json(deletedBook[0]);

})