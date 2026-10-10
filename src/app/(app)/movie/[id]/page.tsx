import { MovieDetails } from "@/components/MovieDetails";

export default async function MoviePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MovieDetails id={id} />;
}
