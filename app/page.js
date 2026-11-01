import ActionButton from "../components/ActionButton";

export default function Home() {


  return (
   <div className="flex flex-col gap-2">
      <h1>this is where the today page is shown</h1>
      <ActionButton label="Phone down, going to sleep" />    
      <ActionButton label="I'm Awake"/>
   </div>
  );
}
