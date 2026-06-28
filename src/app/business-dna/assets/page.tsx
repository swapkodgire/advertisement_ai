import Link from "next/link";
import { Camera, Upload, Link as LinkIcon } from "lucide-react";
import {
  Card,
  DashboardLayout,
  PageHeader,
  PrimaryButton,
} from "@/components/layout/DashboardLayout";

export default function AssetsPage() {
  return (
    <DashboardLayout>
      <div className="p-8">
        <PageHeader
          title="Business DNA — Assets"
          subtitle="Upload brand assets or generate new creatives with AI photoshoot."
        />

        <Card className="mb-8 flex flex-col gap-6 overflow-hidden p-0 sm:flex-row">
          <div className="grid grid-cols-3 gap-1 p-4 sm:w-1/2">
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className={`aspect-square rounded-lg bg-gradient-to-br ${
                  [
                    "from-orange-400 to-red-600",
                    "from-teal-500 to-blue-700",
                    "from-pink-400 to-purple-700",
                    "from-green-400 to-emerald-700",
                    "from-yellow-400 to-orange-600",
                    "from-blue-400 to-indigo-700",
                    "from-rose-400 to-pink-700",
                    "from-cyan-400 to-teal-700",
                    "from-amber-400 to-yellow-700",
                  ][i]
                }`}
              />
            ))}
          </div>
          <div className="flex flex-col justify-center p-8 sm:w-1/2">
            <h2 className="text-xl font-semibold">
              Endless creatives, ready in minutes
            </h2>
            <p className="mt-2 text-sm text-muted">
              Skip the cost and complexity of traditional photoshoots and
              generate compelling, on-brand images that drive your sales.
            </p>
            <Link href="/photoshoot" className="mt-4 inline-block">
              <PrimaryButton>
                <Camera className="h-4 w-4" />
                Try Photoshoot
              </PrimaryButton>
            </Link>
          </div>
        </Card>

        <div className="mb-8 grid grid-cols-2 gap-4 sm:max-w-md">
          <button
            type="button"
            className="glass-tile flex aspect-square flex-col items-center justify-center gap-3 transition-transform hover:!translate-y-[-3px]"
          >
            <Upload className="h-8 w-8 text-muted" />
            <span className="text-sm text-muted">Upload Images</span>
          </button>
          <button
            type="button"
            className="glass-tile flex aspect-square flex-col items-center justify-center gap-3 transition-transform hover:!translate-y-[-3px]"
          >
            <LinkIcon className="h-8 w-8 text-muted" />
            <span className="text-sm text-muted">Add from URL</span>
          </button>
        </div>

        <p className="text-sm text-muted">
          Your uploaded and generated assets will appear here.
        </p>
      </div>
    </DashboardLayout>
  );
}
