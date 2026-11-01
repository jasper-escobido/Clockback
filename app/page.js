import ActionButton from "../components/ActionButton";

export default function Home() {


  return (
   <div className="flex flex-col gap-2 m-6">
      <h1>Today</h1>
      <ActionButton label="Phone down, going to sleep" action="sleep"/>    
      <ActionButton label="I'm Awake" action="wake"/>
   </div>
  );
}
