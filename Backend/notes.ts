import { request } from "express";
import { response } from "express";
import express from "express";

const app = express();
app.use(express.json);


type Note = {
    id : number,
    title : string,
    content: string,
    completed : boolean
}

const notes: Note[] = [
  {
    id: 1,
    title: "Learn TypeScript",
    content: "Practice types and functions",
    completed: false
  },
  {
    id: 2,
    title: "Learn Express",
    content: "Build a small API",
    completed: true
  }
]



app.get("/notes" , (req :Request,res:Response)=>{
    res.json(notes);
    console.log(notes);
})

//get one note 

app.get("/notes.:id", (req : Request , res:response)=>{

    const id = Number(req.params.id)

    const note=notes.find((note) => note.id === id)
    if(!note){
        return res.status(404).json({
            message:"Note not found",
        })
    }
    res.json(note)
})

//create a Note
app.post("/notes", (req:Request , res : Response) => {
    const {title,content}=req.body;

    const newNote: Note={
        id: notes.length+1,
        title,
        content,
        completed:false,
    }
notes.push(newNote);

res.status(200).json(newNote)
})

//updating a note
app.put("/notes/:id", (req:request, res:response) => {
    const id = req.params.id;

    const noteUpd = notes.find((notes) => notes.id === id)

    if (!noteUpd){
        res.status(401).json({
            message:"note not found",
        })
    }

    const {title , content , completed}= req.body
    noteUpd.title=title ?? noteUpd?.title
    noteUpd.content=content
    noteUpd?.completed=completed

})