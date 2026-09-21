import { Request,Response } from "express"
import express from "express"
//creating the task type 

type Task={
    id : number,
    title : string,
    priority : "low"| "medium"|"high",
    done : boolean
}

// seeding tasks
const tasks:Task[]=[
    {
    id: 1,
    title: "Coding",
    priority:"high",
    done: false,

},
{
    id: 2,
    title : "Maths",
    priority:"medium",
    done: true
},
{
    id: 3,
    title : "Cooking",
    priority:"low",
    done: false
},
{
    id: 4,
    title : "Cricket",
    priority:"medium",
    done: false

}
]

let nextid : number = 4;

const app = express();
app.use(express.json());

//get tasks
app.get("/tasks",(req:Request,res:Response) => {
    //get the query parameter
    const done=req.query.done;

    if(done==="true"){
        //finding the task with true;
        const reqTask = tasks.filter((t)=>t.done === true);
        return res.json(reqTask);
    }if(done ==="false"){
         const reqTask = tasks.filter((t)=>t.done === false);
        return res.json(reqTask);

    }
    return res.json(tasks);
})

//get tasks based on id 

app.get("/tasks/:id",(req:Request , res:Response)=>{

    // get the id from the param
    const reqId= Number(req.params.id);

    if (!Number.isInteger(reqId)){
        res.status(400).json({message:"ID is not a valid integer"})
    }
    //look for the task with that id 
    const reqTask= tasks.find((t) => t.id === reqId);
    if(!reqTask){
        return res.status(404).json({message:"task not found "})
    }
    return res.json(reqTask);

    
})

// posting a task 
app.post("/tasks", (req:Request,res:Response) => {
    // get the data from the body
    const {title,priority}=req.body;
    //validate 
    if(title === ""){
        res.status(404).json({message:"Title should not be empty"});
    }if (priority !== "low" && priority !== "medium" && priority !=="high"){
        res.status(404).json({message:"Priority should be low or medium or high"});
        
    }
    const newTask={
        id : nextid++,
        title,
        priority,
        done:false
    } ;

    res.json(newTask);
})
//updating the tasks

app.put("/tasks/:id", (req:Request , res:Response) => {
     const reqId= Number(req.params.id);

    if (!Number.isInteger(reqId)){
        res.status(400).json({message:"ID is not a valid integer"})
    }
    const reqTask= tasks.find((t) => t.id === reqId);
    if(!reqTask){
        return res.status(404).json({message:"task not found "})}

        const {title,done,priority}=req.body;

        if(title !== undefined && title.trim() ===""){
            return res.status(400).json({message:"Title should not be empty"});
        }
        if( priority !== undefined && priority !== "high" && priority !=="low" && priority !=="medium"){
            return res.status(400).json({message:"Priority should be low , medium or high"});
            /*const validPriorities = ["low", "medium", "high"];
if (priority !== undefined && !validPriorities.includes(priority))*/ }

if (done !== undefined && typeof done !== "boolean") {
  return res.status(400).json({ message: "done must be true or false" });
}

       reqTask.title =title ?? reqTask.title;
       reqTask.priority = priority ?? reqTask.priority;
       reqTask.done = done ?? reqTask.done;

       res.json(reqTask);

})

// deleting a task 
app.delete("/tasks/:id", (req:Request,res:Response)=>{
 const reqId= Number(req.params.id);

    if (!Number.isInteger(reqId)){
        res.status(400).json({message:"ID is not a valid integer"})
    }
    const reqTask= tasks.find((t) => t.id === reqId);
    if(!reqTask){
        return res.status(404).json({message:"task not found "})}

        const index = tasks.findIndex((t)=> t.id === reqId);

        tasks.splice(index,1);

        // we use .send() for succesful tasks and no message to send 
        res.status(204).send();

})