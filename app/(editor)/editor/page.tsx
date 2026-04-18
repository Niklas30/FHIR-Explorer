import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function EditorPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Projects Overview</CardTitle>
          <CardDescription>
            This is a placeholder for datasets and composer workspaces.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            The project list will appear here once the dataset composer is
            implemented.
          </p>
          <Button asChild variant="secondary" className="w-fit">
            <Link href="/importer">Back to Importer</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
