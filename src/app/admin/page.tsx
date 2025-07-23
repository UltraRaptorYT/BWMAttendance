"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export default function AdminPage() {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    return;
  };

  return (
    <div className="p-6 w-full">
      <h1 className="text-2xl font-bold">Admin Panel</h1>
      <form onSubmit={handleSubmit} className="flex flex-col space-y-5">
        <div className="grid w-full max-w-sm items-center gap-3">
          <Label htmlFor="eventName">Event Name</Label>
          <Input
            type="text"
            id="eventName"
            placeholder="Enter Event Name"
          />
        </div>
        <div className="grid w-full max-w-sm items-center gap-3">
          <Label htmlFor="sheetLink">Sheet Link</Label>
          <Input
            type="url"
            id="sheetLink"
            placeholder="Enter Sheet Link"
          />
        </div>
        <Button type="submit">Create Event</Button>
      </form>
    </div>
  );
}
