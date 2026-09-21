
function App() {
	return (
		<section className="min-h-screen flex items-center justify-center font-mono bg-gradient-to-r from-cyan-200 from-10%
    via-indigo-500 via-45% to-sky-500- via-35%">

<div className="flex flex-col items-center justify-center text-center p-15 gap-8 rounded-2xl bg-white">
  
  <h1 className=" text-3xl font-bold">Welcome </ h1>
  
  <div className="flex flex-col text-2xl text-left gap-1">
    <span>UserName:</span>
    <input type="text" className="rounded-md p-1 border-2 outline-none focus:border-cyan-100 focus:bg-slate-50"></input>
  </div>

  <div className="flex flex-col text-2xl text-left gap-1">
    <span>Password:</span>
  <input type="text" className="rounded-md p-1 border-2 outline-none focus:border-cyan-100 focus:bg-slate-50"></input>
  </div>

  <div className="flex gap-1 items-center">
    <input type="checkbox"/>
    <span className="font-black">Remember Password</span>
                 </div>

  
    <button  className="px-10 py-2  text-2xl rounded-md bg-gradient-to-r from-green-400 from-20% to bg-sky-300 from-15%">
      Login 
    </button>
  
  <p className="font-semibold">Don't have an Account? 
    <a href="#" className="text-blue-500 hover:underline">Register</a>
  </p>

  
  
  </div>
  


    </section>
	)
}

export default App
